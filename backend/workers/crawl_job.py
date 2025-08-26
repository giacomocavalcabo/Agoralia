"""
Web crawling worker using Dramatiq
Respects robots.txt, rate limiting, and integrates with existing KB pipeline
"""
import re
import time
import hashlib
import secrets
from urllib.parse import urlparse, urljoin, urldefrag
from datetime import datetime
import logging
from typing import List, Optional

# Dramatiq imports
import dramatiq
from dramatiq import actor
from sqlalchemy.orm import Session

# Local imports
from backend.models import get_db, KbSource, KbDocument, KbImportJob, KbChunk
from backend.workers.kb_jobs import chunk_job, parse_file_job

# Configure logging
logger = logging.getLogger(__name__)

# Safe and binary file extensions
SAFE_EXT = (".pdf", ".txt", ".md", ".html", ".htm")
BIN_EXT = (".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico", ".zip", ".gz", 
           ".rar", ".7z", ".mp4", ".mp3", ".wav", ".avi", ".mov", ".dmg", ".exe", ".msi")

# Try to import optional dependencies
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    logger.warning("httpx not available, crawl will use demo mode")

try:
    from bs4 import BeautifulSoup
    BEAUTIFULSOUP_AVAILABLE = True
except ImportError:
    BEAUTIFULSOUP_AVAILABLE = False
    logger.warning("beautifulsoup4 not available, crawl will use demo mode")

try:
    from urllib import robotparser
    ROBOTPARSER_AVAILABLE = True
except ImportError:
    ROBOTPARSER_AVAILABLE = False
    logger.warning("robotparser not available, robots.txt will be ignored")


def _norm_url(base: str, href: str) -> str:
    """Normalize and join URLs"""
    if not href:
        return ""
    try:
        href = urljoin(base, href)
        href = urldefrag(href)[0]
        return href
    except:
        return ""


def _match_any(patterns: List[str], text: str) -> bool:
    """Check if any regex pattern matches text"""
    for p in patterns or []:
        try:
            if re.search(p, text):
                return True
        except re.error:
            continue
    return False


def _same_domain(u1: str, u2: str) -> bool:
    """Check if two URLs belong to the same domain"""
    try:
        return urlparse(u1).netloc.lower() == urlparse(u2).netloc.lower()
    except:
        return True


def _is_binary_url(url: str) -> bool:
    """Check if URL points to binary content"""
    path = urlparse(url).path.lower()
    return any(path.endswith(ext) for ext in BIN_EXT)


def _update_progress(db: Session, job_id: str, **kwargs):
    """Update job progress"""
    job = db.query(KbImportJob).filter(KbImportJob.id == job_id).first()
    if not job:
        return
    
    prog = job.progress_json or {}
    prog.update(kwargs)
    
    # Calculate progress percentage
    enq = prog.get("pages_enqueued", 0) or 0
    done = prog.get("pages_processed", 0) or 0
    total = max(enq, done, 1)
    job.progress_pct = int((done / total) * 100)
    job.progress_json = prog
    job.updated_at = datetime.utcnow()
    db.commit()


def _save_doc(db: Session, source_id: str, url: str, title: str, mime_type: str, text: str, lang: str = None):
    """Save crawled document to database"""
    doc = KbDocument(
        id=f"doc_{secrets.token_urlsafe(8)}",
        source_id=source_id,
        title=title or url,
        mime_type=mime_type,
        bytes=len(text.encode("utf-8")) if text else 0,
        checksum=hashlib.sha256((text or "").encode("utf-8")).hexdigest(),
        version=1,
        lang=lang or "und",
        parsed_text=text or "",
        outline_json=None,
        created_at=datetime.utcnow()
    )
    db.add(doc)
    db.commit()
    return doc.id


@actor(queue_name="q:kb:crawl")
def crawl_site_job(
    job_id: str,
    source_id: str,
    seed_url: str,
    depth: int,
    max_pages: int,
    include: List[str],
    exclude: List[str],
    same_domain_only: bool,
    user_agent: str,
    workspace_id: str,
):
    """Main crawl job - BFS with robots.txt and rate limiting"""
    with next(get_db()) as db:
        _run_crawl(
            db, job_id, source_id, seed_url, depth, max_pages, 
            include, exclude, same_domain_only, user_agent, workspace_id
        )


def _run_crawl(
    db: Session, 
    job_id: str, 
    source_id: str, 
    seed_url: str, 
    depth: int, 
    max_pages: int, 
    include: List[str], 
    exclude: List[str], 
    same_domain_only: bool, 
    user_agent: str, 
    workspace_id: str
):
    """Execute the actual crawl"""
    job = db.query(KbImportJob).filter(KbImportJob.id == job_id).first()
    src = db.query(KbSource).filter(KbSource.id == source_id).first()
    
    if not job or not src:
        logger.error(f"Job {job_id} or source {source_id} not found")
        return

    if src.status != "processing":
        src.status = "processing"
        db.commit()

    # DEMO MODE: generate fake documents and exit
    from backend.config.settings import DEMO_MODE
    if DEMO_MODE:
        logger.info(f"DEMO MODE: Generating {min(max_pages, 5)} fake documents for {seed_url}")
        
        for i in range(min(max_pages, 5)):
            doc_id = _save_doc(
                db, source_id, 
                f"{seed_url}#demo-{i}", 
                f"Demo Page {i+1}", 
                "text/html", 
                f"Demo content page {i+1} about {seed_url}. This is sample content for demonstration purposes."
            )
            # Trigger chunking immediately
            chunk_job.send(doc_id)
            _update_progress(db, job_id, pages_enqueued=i+1, pages_processed=i+1)
        
        job.status = "completed"
        src.status = "ready"
        src.updated_at = datetime.utcnow()
        db.commit()
        logger.info(f"DEMO MODE: Crawl completed for {seed_url}")
        return

    # Check if required dependencies are available
    if not HTTPX_AVAILABLE or not BEAUTIFULSOUP_AVAILABLE:
        logger.error("Required dependencies not available for crawling")
        job.status = "failed"
        src.status = "error"
        db.commit()
        return

    # Setup robots.txt parser
    rp = None
    if ROBOTPARSER_AVAILABLE:
        try:
            rp = robotparser.RobotFileParser()
            robots_url = urljoin(seed_url, "/robots.txt")
            rp.set_url(robots_url)
            rp.read()
            logger.info(f"Robots.txt loaded from {robots_url}")
        except Exception as e:
            logger.warning(f"Failed to load robots.txt: {e}")
            rp = None

    # Setup HTTP client
    headers = {"User-Agent": user_agent}
    client = httpx.Client(timeout=10.0, headers=headers, follow_redirects=True)

    # BFS queue: (url, depth)
    q = [(seed_url, 0)]
    seen = set([seed_url])
    enqueued = 1
    processed = 0
    failed = 0
    
    _update_progress(db, job_id, pages_enqueued=enqueued, pages_processed=processed, pages_failed=failed)

    try:
        while q and processed < max_pages:
            url, d = q.pop(0)
            logger.info(f"Processing {url} at depth {d}")

            # Check robots.txt
            if rp and rp.default_entry:
                try:
                    if not rp.can_fetch(user_agent, url):
                        logger.info(f"Robots.txt disallows: {url}")
                        failed += 1
                        _update_progress(
                            db, job_id, pages_failed=failed, 
                            last_error=f"robots disallow {url}"
                        )
                        continue
                except Exception as e:
                    logger.warning(f"Robots.txt check failed: {e}")

            # Skip binary files
            if _is_binary_url(url):
                if url.lower().endswith(".pdf"):
                    # Register PDF document for parse_file_job to handle
                    doc_id = _save_doc(db, source_id, url, "PDF Document", "application/pdf", "")
                    parse_file_job.send(doc_id)
                    processed += 1
                    _update_progress(db, job_id, pages_processed=processed)
                    logger.info(f"PDF document queued: {url}")
                else:
                    failed += 1
                    _update_progress(
                        db, job_id, pages_failed=failed, 
                        last_error=f"skip binary {url}"
                    )
                    logger.info(f"Skipping binary file: {url}")
                continue

            # Fetch page
            try:
                resp = client.get(url)
                logger.info(f"Fetched {url}: {resp.status_code}")
            except Exception as e:
                logger.error(f"Failed to fetch {url}: {e}")
                failed += 1
                _update_progress(db, job_id, pages_failed=failed, last_error=str(e))
                continue

            # Check content type
            ctype = resp.headers.get("content-type", "")
            if "text/html" not in ctype:
                if "application/pdf" in ctype:
                    doc_id = _save_doc(db, source_id, url, "PDF Document", "application/pdf", "")
                    parse_file_job.send(doc_id)
                    processed += 1
                    _update_progress(db, job_id, pages_processed=processed)
                    logger.info(f"PDF document queued: {url}")
                else:
                    failed += 1
                    _update_progress(
                        db, job_id, pages_failed=failed, 
                        last_error=f"skip content-type {ctype}"
                    )
                    logger.info(f"Skipping non-HTML content: {url} ({ctype})")
                continue

            # Parse HTML content
            html = resp.text or ""
            soup = BeautifulSoup(html, "lxml")
            title = (soup.title.string.strip() if soup.title and soup.title.string else url)
            
            # Remove boilerplate
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            
            text = " ".join(soup.get_text(" ").split())

            # Save HTML document
            doc_id = _save_doc(db, source_id, url, title, "text/html", text)
            logger.info(f"Saved HTML document: {title} ({len(text)} chars)")
            
            # Queue chunking
            chunk_job.send(doc_id)

            processed += 1
            _update_progress(db, job_id, pages_processed=processed)

            # Enqueue links if under depth limit
            if d < depth:
                for a in soup.find_all("a", href=True):
                    href = _norm_url(url, a["href"])
                    if not href or href in seen:
                        continue
                    
                    if same_domain_only and not _same_domain(seed_url, href):
                        continue
                    
                    if include and not _match_any(include, href):
                        continue
                    
                    if exclude and _match_any(exclude, href):
                        continue
                    
                    seen.add(href)
                    q.append((href, d + 1))
                    enqueued += 1
                    
                    if enqueued >= max_pages:
                        break
                
                _update_progress(db, job_id, pages_enqueued=enqueued)

            # Rate limiting
            time.sleep(0.8)  # Respectful crawling

        # Mark job as completed
        job.status = "completed"
        src.status = "ready"
        src.updated_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Crawl completed: {processed} pages processed, {failed} failed")

    except Exception as e:
        logger.error(f"Crawl failed: {e}")
        job.status = "failed"
        prog = job.progress_json or {}
        prog["last_error"] = str(e)
        job.progress_json = prog
        src.status = "error"
        db.commit()
    
    finally:
        client.close()
