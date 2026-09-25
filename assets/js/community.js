// set vars for calling api
let apiKey = "&key=AIzaSyAzrBuUUtL34scmof_gZN2Vbk4iimMhBV8";
let apiUrl = "https://www.googleapis.com/youtube/v3/";
let kind = "playlists?"
let part = "part=snippet%2C+id";
let maxResults="&maxResults=1";
let playlistIds = "&id=PLgEMYwvTcDT54FsOk4yVWkJZ4i3Xcz1mM&id=PLgEMYwvTcDT5V1RiSoPh1RheOgDYJ88jK&id=PLgEMYwvTcDT6N_jJrA_Jo8m9twRwolHK-&id=PLgEMYwvTcDT4AqQXvh2fVmJX_kIVMAT7Q&id=PLgEMYwvTcDT4qBIZCMpTgiTOCSRqU1KtL";
let url = apiUrl + kind + part + maxResults + playlistIds + apiKey 

// create iframe for youtube video
function createIframe(title, link) {
  var iframe = document.createElement('iframe');
  iframe.frameBorder = '0';
  iframe.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture';
  iframe.title = title;
  iframe.loading = 'lazy';
  iframe.allowFullscreen = true;
  iframe.setAttribute("src", link);
  return iframe
};

// fetch the pirate chain channel api
function updateVideoSources() {
    fetch(url)
    .then(response => response.json())
    .then(data => {
        if (!Array.isArray(data.items)) return;

        // iterate through teh results (one item for each playlist)
        for (const key in data.items) {
            // get the playlist ID
            var playlistId = data.items[key].id; 

            if (playlistId === "PLgEMYwvTcDT4qBIZCMpTgiTOCSRqU1KtL") {
              var videoId = "EKcs6v5tE-8";
            } else {
              // get videoId from thumbnail URL. No better way known without more calls-----------------------------???
              var thumb_url = data.items[key].snippet.thumbnails.default.url;
              var url_array = thumb_url.split("/");
              var videoId = url_array[4];
            };

            // append iframe source 
            var title = data.items[key].snippet.title;
            var link = `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&controls=0&showinfo=0&fs=0`;
            var iframe = createIframe(title, link);
            const container = document.getElementById(playlistId);
            if (container) container.appendChild(iframe);
        };  
    }).catch(error => console.warn('Community playlists unavailable:', error));
};

// get most recent DDoPC video
function updateDDoPC() {
  var ddopc_playlistId = "&playlistId=UUZ7DYZElMmOInegzvnVDrEg"
  var ddopc_key = '&key=AIzaSyCum9hRApF3TtPZn9tBLrrqxXRpF3jDn6s';
  var ddopc_kind = "playlistItems?";
  var ddopc_url = apiUrl + ddopc_kind + part + maxResults + ddopc_playlistId + ddopc_key;
  fetch(ddopc_url)
  .then(response => response.json())
  .then(data => {

    // get the most recent video id
    var videoId = data.items?.[0]?.snippet?.resourceId?.videoId;
    if (!videoId) return;

    // append iframe source 
    var title = "Daily Dose of Pirate Chain";
    var link = `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&controls=0&showinfo=0&fs=0`;
    var iframe = createIframe(title, link);
    const container = document.getElementById('ddopc');
    if (container) container.appendChild(iframe);
  }).catch(error => console.warn('Daily Dose video unavailable:', error));
};

document.addEventListener('DOMContentLoaded', function() {
    const loadVideos = () => {
      updateVideoSources();
      updateDDoPC();
    };
    const firstPlaylist = document.getElementById('ddopc');
    if (!firstPlaylist || !('IntersectionObserver' in window)) {
      loadVideos();
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      loadVideos();
    }, { rootMargin: '400px' });
    observer.observe(firstPlaylist);
});
