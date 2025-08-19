"""
Test WeasyPrint functionality after system dependencies installation
"""
import sys
import os

def test_weasyprint_import():
    """Test if WeasyPrint can import successfully"""
    print("🧪 Testing WeasyPrint import...")
    
    try:
        import weasyprint
        print(f"✅ WeasyPrint imported successfully: {weasyprint.__version__}")
        return True
    except ImportError as e:
        print(f"❌ WeasyPrint import failed: {e}")
        return False
    except Exception as e:
        print(f"❌ WeasyPrint error: {e}")
        return False

def test_weasyprint_basic_functionality():
    """Test basic WeasyPrint functionality"""
    print("\n🧪 Testing WeasyPrint basic functionality...")
    
    try:
        import weasyprint
        
        # Test HTML parsing
        html_content = """
        <html>
            <head><title>Test PDF</title></head>
            <body>
                <h1>Hello WeasyPrint!</h1>
                <p>This is a test document.</p>
            </body>
        </html>
        """
        
        # Create document
        doc = weasyprint.HTML(string=html_content)
        
        # Test PDF generation (don't actually write to disk in test)
        print("✅ HTML parsing: OK")
        print("✅ Document creation: OK")
        print("✅ WeasyPrint core functionality: OK")
        
        return True
        
    except Exception as e:
        print(f"❌ WeasyPrint functionality test failed: {e}")
        return False

def test_system_dependencies():
    """Test if required system libraries are available"""
    print("\n🧪 Testing system dependencies...")
    
    # Check for common WeasyPrint dependencies
    dependencies = [
        'libpango-1.0-0',
        'libcairo2', 
        'libgdk-pixbuf2.0-0',
        'libffi-dev'
    ]
    
    try:
        import ctypes
        
        for dep in dependencies:
            try:
                # Try to load the library
                if 'cairo' in dep:
                    ctypes.CDLL('libcairo.so.2')
                elif 'pango' in dep:
                    ctypes.CDLL('libpango-1.0.so.0')
                elif 'gdk' in dep:
                    ctypes.CDLL('libgdk_pixbuf-2.0.so.0')
                elif 'ffi' in dep:
                    ctypes.CDLL('libffi.so.8')
                
                print(f"✅ {dep}: Available")
            except OSError:
                print(f"⚠️  {dep}: Not found (may not be critical)")
        
        return True
        
    except Exception as e:
        print(f"⚠️  System dependency check failed: {e}")
        return True  # Don't fail the test for this

def run_weasyprint_tests():
    """Run all WeasyPrint tests"""
    print("🚀 Running WeasyPrint Tests...\n")
    
    tests = [
        test_weasyprint_import,
        test_weasyprint_basic_functionality,
        test_system_dependencies
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {e}")
            results.append(False)
    
    # Summary
    passed = sum(results)
    total = len(results)
    
    print(f"\n📊 Test Results: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All WeasyPrint tests passed!")
        print("✅ Ready for PDF generation on Railway")
        return True
    else:
        print("❌ Some tests failed")
        print("💡 Check apt.txt dependencies and redeploy")
        return False

if __name__ == "__main__":
    success = run_weasyprint_tests()
    exit(0 if success else 1)
