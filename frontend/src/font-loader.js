// Font loading script - CSP compliant
document.addEventListener('DOMContentLoaded', function() {
  const fontLink = document.getElementById('font-preload');
  if (fontLink) {
    fontLink.onload = function() {
      this.onload = null;
      this.rel = 'stylesheet';
    };
  }
});
