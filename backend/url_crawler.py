"""
Advanced URL crawler with robots.txt respect, ETag support, and SimHash deduplication
"""
import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup
from readability import Document

logger = logging.getLogger(__name__)

@dataclass
class CrawledContent:
    """Container for crawled content with metadata"""
    url: str
    title: str
    text: str
    html: str
    etag: Optional[str] = None
    last_modified: Optional[str] = None
    simhash: Optional[str] = None
    depth: int = 0
    links: List[str] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.links is None:
            self.links = []
        if self.metadata is None:
            self.metadata = {}
        if self.simhash is None:
            self.simhash = self._calculate_simhash()
    
    def _calculate_simhash(self) -> str:
        """Calculate SimHash for content deduplication"""
        # Simple SimHash implementation
        words = re.findall(r'\b\w+\b', self.text.lower())
        word_freq = {}
        for word in words:
            if len(word) > 2:  # Skip very short words
                word_freq[word] = word_freq.get(word, 0) + 1
        
        # Create feature vector
        features = []
        for word, freq in sorted(word_freq.items())[:100]:  # Top 100 words
            features.extend([word] * min(freq, 3))  # Cap frequency at 3
        
        # Generate hash
        content_hash = hashlib.sha256(" ".join(features).encode()).hexdigest()
        return content_hash[:16]  # Return first 16 chars for readability

class URLCrawler:
    """Advanced web crawler with respect for robots.txt and deduplication"""
    
    def __init__(self, base_url: str, max_depth: int = 2, max_pages: int = 10):
        self.base_url = base_url
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.visited_urls = set()
        self.robots_parser = None
        self.session = httpx.Client(
            timeout=30.0,
            follow_redirects=True,
            headers={
                'User-Agent': 'ColdAI-KB-Crawler/1.0 (+https://agoralia.ai)'
            }
        )
        self._init_robots_parser()
    
    def _init_robots_parser(self):
        """Initialize robots.txt parser"""
        try:
            robots_url = urljoin(self.base_url, '/robots.txt')
            response = self.session.get(robots_url, timeout=10)
            if response.status_code == 200:
                self.robots_parser = RobotFileParser()
                self.robots_parser.set_url(robots_url)
                self.robots_parser.read()
                logger.info(f"Robots.txt loaded from {robots_url}")
            else:
                logger.warning(f"Robots.txt not found at {robots_url}")
        except Exception as e:
            logger.warning(f"Failed to load robots.txt: {e}")
    
    def can_crawl(self, url: str = None) -> bool:
        """Check if URL can be crawled according to robots.txt"""
        if not self.robots_parser:
            return True  # Allow if no robots.txt
        
        url_to_check = url or self.base_url
        return self.robots_parser.can_fetch('ColdAI-KB-Crawler', url_to_check)
    
    def _get_page_with_cache_headers(self, url: str) -> Optional[httpx.Response]:
        """Get page with ETag and If-Modified-Since support"""
        try:
            # Check if we have cached version
            cached_etag = self._get_cached_etag(url)
            cached_last_modified = self._get_cached_last_modified(url)
            
            headers = {}
            if cached_etag:
                headers['If-None-Match'] = cached_etag
            if cached_last_modified:
                headers['If-Modified-Since'] = cached_last_modified
            
            response = self.session.get(url, headers=headers)
            
            if response.status_code == 304:  # Not Modified
                logger.info(f"Page {url} not modified, using cached version")
                return self._get_cached_response(url)
            
            return response
            
        except Exception as e:
            logger.error(f"Failed to fetch {url}: {e}")
            return None
    
    def _get_cached_etag(self, url: str) -> Optional[str]:
        """Get cached ETag for URL (simplified - in production use Redis/DB)"""
        # TODO: Implement proper caching with Redis
        return None
    
    def _get_cached_last_modified(self, url: str) -> Optional[str]:
        """Get cached Last-Modified for URL"""
        # TODO: Implement proper caching with Redis
        return None
    
    def _get_cached_response(self, url: str) -> Optional[httpx.Response]:
        """Get cached response (simplified)"""
        # TODO: Implement proper caching with Redis
        return None
    
    def _extract_text_content(self, html: str, url: str) -> tuple[str, str, List[str]]:
        """Extract clean text content, title, and links from HTML"""
        try:
            # Use readability for main content extraction
            doc = Document(html)
            title = doc.title() or "Untitled"
            
            # Extract main content
            soup = BeautifulSoup(doc.summary(), 'html.parser')
            
            # Remove script, style, and navigation elements
            for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
                element.decompose()
            
            # Extract text
            text = soup.get_text()
            
            # Clean up text
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            clean_text = ' '.join(chunk for chunk in chunks if chunk)
            
            # Extract links (for potential deeper crawling)
            full_soup = BeautifulSoup(html, 'html.parser')
            links = []
            for link in full_soup.find_all('a', href=True):
                href = link['href']
                if href.startswith('/') or href.startswith(self.base_url):
                    full_url = urljoin(url, href)
                    if full_url.startswith(self.base_url):
                        links.append(full_url)
            
            return clean_text, title, links
            
        except Exception as e:
            logger.error(f"Failed to extract content from {url}: {e}")
            return "", "Error extracting content", []
    
    def crawl(self) -> CrawledContent:
        """Main crawling method with depth control and deduplication"""
        if not self.can_crawl():
            raise ValueError(f"URL {self.base_url} not allowed by robots.txt")
        
        logger.info(f"Starting crawl of {self.base_url}")
        
        # Crawl main page
        main_content = self._crawl_single_page(self.base_url, depth=0)
        if not main_content:
            raise ValueError(f"Failed to crawl main page {self.base_url}")
        
        # Crawl additional pages if within limits
        additional_pages = []
        if main_content.links and self.max_depth > 1:
            additional_pages = self._crawl_additional_pages(main_content.links)
        
        # Combine content
        all_content = [main_content] + additional_pages
        
        # Deduplicate by SimHash
        unique_content = self._deduplicate_by_simhash(all_content)
        
        # Merge content
        merged_content = self._merge_content(unique_content)
        
        logger.info(f"Crawl completed: {len(unique_content)} unique pages, {len(merged_content.text)} chars")
        return merged_content
    
    def _crawl_single_page(self, url: str, depth: int) -> Optional[CrawledContent]:
        """Crawl a single page"""
        if url in self.visited_urls:
            return None
        
        self.visited_urls.add(url)
        
        try:
            response = self._get_page_with_cache_headers(url)
            if not response or response.status_code != 200:
                return None
            
            # Extract content
            text, title, links = self._extract_text_content(response.text, url)
            
            if len(text) < 100:  # Skip pages with too little content
                return None
            
            # Get cache headers
            etag = response.headers.get('ETag')
            last_modified = response.headers.get('Last-Modified')
            
            return CrawledContent(
                url=url,
                title=title,
                text=text,
                html=response.text,
                etag=etag,
                last_modified=last_modified,
                depth=depth,
                links=links
            )
            
        except Exception as e:
            logger.error(f"Failed to crawl {url}: {e}")
            return None
    
    def _crawl_additional_pages(self, links: List[str]) -> List[CrawledContent]:
        """Crawl additional pages within depth limit"""
        additional_pages = []
        crawled_count = 0
        
        for link in links[:self.max_pages - 1]:  # -1 because we already have main page
            if crawled_count >= self.max_pages - 1:
                break
            
            if not self.can_crawl(link):
                continue
            
            content = self._crawl_single_page(link, depth=1)
            if content:
                additional_pages.append(content)
                crawled_count += 1
            
            # Rate limiting
            time.sleep(0.5)
        
        return additional_pages
    
    def _deduplicate_by_simhash(self, contents: List[CrawledContent]) -> List[CrawledContent]:
        """Remove duplicate content using SimHash"""
        unique_contents = []
        seen_hashes = set()
        
        for content in contents:
            if content.simhash not in seen_hashes:
                unique_contents.append(content)
                seen_hashes.add(content.simhash)
            else:
                logger.info(f"Skipping duplicate content from {content.url} (SimHash: {content.simhash})")
        
        return unique_contents
    
    def _merge_content(self, contents: List[CrawledContent]) -> CrawledContent:
        """Merge multiple page contents into one"""
        if not contents:
            raise ValueError("No content to merge")
        
        if len(contents) == 1:
            return contents[0]
        
        # Merge main page with additional content
        main_content = contents[0]
        
        # Combine text from additional pages
        additional_text = []
        for content in contents[1:]:
            if content.text:
                additional_text.append(f"\n\n--- {content.title} ---\n{content.text}")
        
        merged_text = main_content.text + "".join(additional_text)
        
        # Create merged content
        merged_content = CrawledContent(
            url=main_content.url,
            title=main_content.title,
            text=merged_text,
            html=main_content.html,
            etag=main_content.etag,
            last_modified=main_content.last_modified,
            depth=main_content.depth,
            links=main_content.links,
            metadata={
                "merged_pages": len(contents),
                "total_chars": len(merged_text),
                "crawl_depth": max(c.depth for c in contents)
            }
        )
        
        return merged_content
    
    def close(self):
        """Clean up resources"""
        if self.session:
            self.session.close()
