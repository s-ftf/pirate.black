// copy text to clipboard
function copyText(el) {
    // Read the original address without visual line wrapping.
    var text = document.getElementById(el).textContent.trim();
  
    // Copy the text inside the text field
    navigator.clipboard.writeText(text);
    
    // show copid response bove tooltip
    var tooltip = document.getElementById("tooltip").style;
    tooltip.opacity = 1;
    (function fade(){(tooltip.opacity-=.1)<0?tooltip.opacity="0":setTimeout(fade,80)})();
}
