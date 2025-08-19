import os
import subprocess
import tempfile
import pathlib
from typing import Optional

def _find_chromium_binary() -> Optional[str]:
    """Find available Chromium binary with fallback options"""
    # Common Chromium binary names
    chromium_names = [
        "chromium",
        "chromium-browser", 
        "google-chrome",
        "google-chrome-stable"
    ]
    
    # Check PATH for each binary
    for name in chromium_names:
        if _check_binary_available(name):
            return name
    
    return None

def _check_binary_available(binary_name: str) -> bool:
    """Check if binary is available and executable"""
    try:
        result = subprocess.run(
            [binary_name, "--version"],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except:
        return False

# Get Chromium binary with fallback
CHROMIUM_BIN = os.getenv("CHROMIUM_BIN") or _find_chromium_binary() or "chromium"

def html_to_pdf_chromium(
    html: str, 
    output_path: Optional[str] = None,
    landscape: bool = False,
    format: str = "A4"
) -> bytes:
    """
    Convert HTML to PDF using headless Chromium
    
    Args:
        html: HTML content as string
        output_path: Optional path to save PDF (if None, returns bytes)
        landscape: Page orientation
        format: Page format (A4, Letter, etc.)
    
    Returns:
        PDF content as bytes
    """
    if not CHROMIUM_BIN:
        raise RuntimeError("No Chromium binary found. Install chromium package via apt.txt")
    
    with tempfile.TemporaryDirectory() as td:
        html_path = pathlib.Path(td) / "doc.html"
        pdf_path = pathlib.Path(td) / "doc.pdf"
        
        # Write HTML to temp file
        html_path.write_text(html, encoding="utf-8")
        
        # Build Chromium command
        cmd = [
            CHROMIUM_BIN,
            "--headless",
            "--disable-gpu",
            "--no-sandbox",  # Required for Railway/containers
            "--disable-dev-shm-usage",
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
            f"--print-to-pdf={pdf_path}",
            "--print-to-pdf-no-header",
            f"--print-to-pdf-landscape={str(landscape).lower()}",
            f"--print-to-pdf-paper-size={format}",
            f"file://{html_path}"
        ]
        
        try:
            # Run Chromium
            result = subprocess.run(
                cmd, 
                check=True, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE,
                timeout=30  # 30 second timeout
            )
            
            # Read PDF content
            pdf_bytes = pdf_path.read_bytes()
            
            # Save to output path if specified
            if output_path:
                pathlib.Path(output_path).write_bytes(pdf_bytes)
            
            return pdf_bytes
            
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Chromium PDF generation failed: {e.stderr.decode()}")
        except subprocess.TimeoutExpired:
            raise RuntimeError("Chromium PDF generation timed out")
        except Exception as e:
            raise RuntimeError(f"PDF generation error: {e}")

def check_chromium_available() -> bool:
    """Check if Chromium is available and executable"""
    return bool(CHROMIUM_BIN and _check_binary_available(CHROMIUM_BIN))

def get_chromium_version() -> Optional[str]:
    """Get Chromium version if available"""
    if not CHROMIUM_BIN:
        return None
        
    try:
        result = subprocess.run(
            [CHROMIUM_BIN, "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except:
        pass
    return None

def get_chromium_info() -> dict:
    """Get comprehensive Chromium information"""
    return {
        "available": check_chromium_available(),
        "binary": CHROMIUM_BIN,
        "version": get_chromium_version(),
        "fallback_used": CHROMIUM_BIN != os.getenv("CHROMIUM_BIN")
    }
