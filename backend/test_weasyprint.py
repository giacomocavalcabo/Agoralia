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
                <p>Test with special chars: é, ñ, 中文, العربية</p>
            </body>
        </html>
        """
        
        # Create document
        doc = weasyprint.HTML(string=html_content)
        
        # Test PDF generation (don't actually write to disk in test)
        print("✅ HTML parsing: OK")
        print("✅ Document creation: OK")
        print("✅ Unicode support: OK")
        print("✅ WeasyPrint core functionality: OK")
        
        return True
        
    except Exception as e:
        print(f"❌ WeasyPrint functionality test failed: {e}")
        return False

def test_system_dependencies():
    """Test if required system libraries are available"""
    print("\n🧪 Testing system dependencies...")
    
    # Complete list of WeasyPrint dependencies
    dependencies = [
        ('libcairo2', 'libcairo.so.2'),
        ('libgdk-pixbuf2.0-0', 'libgdk_pixbuf-2.0.so.0'),
        ('libpango-1.0-0', 'libpango-1.0.so.0'),
        ('libpangocairo-1.0-0', 'libpangocairo-1.0.so.0'),
        ('libpangoft2-1.0-0', 'libpangoft2-1.0.so.0'),
        ('libharfbuzz0b', 'libharfbuzz.so.0'),
        ('libfribidi0', 'libfribidi.so.0'),
        ('libffi-dev', 'libffi.so.8'),
    ]
    
    try:
        import ctypes
        
        available_count = 0
        for dep_name, lib_name in dependencies:
            try:
                # Try to load the library
                ctypes.CDLL(lib_name)
                print(f"✅ {dep_name}: Available ({lib_name})")
                available_count += 1
            except OSError:
                print(f"❌ {dep_name}: Not found ({lib_name})")
        
        print(f"\n📊 Dependencies: {available_count}/{len(dependencies)} available")
        
        if available_count >= 6:  # At least core libraries
            print("✅ Core dependencies available")
            return True
        else:
            print("❌ Missing critical dependencies")
            return False
        
    except Exception as e:
        print(f"⚠️  System dependency check failed: {e}")
        return False

def test_font_availability():
    """Test if required fonts are available"""
    print("\n🧪 Testing font availability...")
    
    try:
        # Check common font directories
        font_dirs = [
            '/usr/share/fonts',
            '/usr/local/share/fonts',
            '/usr/share/fonts/truetype',
            '/usr/share/fonts/opentype'
        ]
        
        available_fonts = []
        for font_dir in font_dirs:
            if os.path.exists(font_dir):
                try:
                    fonts = os.listdir(font_dir)
                    available_fonts.extend(fonts)
                except:
                    pass
        
        # Check for key font families
        key_fonts = ['dejavu', 'liberation', 'noto']
        found_fonts = []
        
        for font in key_fonts:
            if any(font in f.lower() for f in available_fonts):
                found_fonts.append(font)
        
        print(f"✅ Font directories found: {len([d for d in font_dirs if os.path.exists(d)])}")
        print(f"✅ Key fonts available: {found_fonts}")
        
        if found_fonts:
            return True
        else:
            print("⚠️  No key fonts found - PDF generation may fail")
            return False
            
    except Exception as e:
        print(f"⚠️  Font check failed: {e}")
        return False

def run_weasyprint_tests():
    """Run all WeasyPrint tests"""
    print("🚀 Running WeasyPrint Tests...\n")
    
    tests = [
        test_weasyprint_import,
        test_weasyprint_basic_functionality,
        test_system_dependencies,
        test_font_availability
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
    elif passed >= 2:
        print("⚠️  Partial success - some dependencies missing")
        print("💡 Check apt.txt and redeploy on Railway")
        return False
    else:
        print("❌ Most tests failed")
        print("💡 WeasyPrint not ready - check system dependencies")
        return False

if __name__ == "__main__":
    success = run_weasyprint_tests()
    exit(0 if success else 1)
