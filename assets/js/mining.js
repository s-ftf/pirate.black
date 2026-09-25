// button to play music 
function play_pause() {
    var audio = document.getElementById("og");
    var img = document.getElementById("pp");
    var button = img.closest('button');
    if (audio.paused) {
      audio.play();
      img.src = BASEURL + "assets/img/icons/pause.svg"
      button.setAttribute('aria-label', 'Pause mining audio');
    } else {
      audio.pause();
      img.src = BASEURL + "assets/img/icons/play.svg"
      button.setAttribute('aria-label', 'Play mining audio');
    }
};

// reveal a youtube embed and play
function playVideo(element) {
    // The id of the container must be passed
    var container = document.getElementById(element);

    // show iframe and update source to playi t
    var video = container.getElementsByTagName("iframe")[0];
    var src = video.src;
    video.src = src + "?autoplay=1";
    video.style.display = "block";
};

const explorerUrls = [
    'https://explorer.pirate.black/insight-api-komodo/status?q=getInfo',
    'https://pirate.explorer.dexstats.info/insight-api-komodo/status?q=getInfo'
];
const priceUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=pirate-chain&vs_currencies=usd&include_last_updated_at=true';
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdQuote = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 });
const arrr = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

async function getNetworkInfo() {
    for (const url of explorerUrls) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Explorer returned ${response.status}`);
            const { info } = await response.json();
            const height = Number(info && info.blocks);
            const difficulty = Number(info && info.difficulty);
            if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(difficulty) || difficulty <= 0) {
                throw new Error('Explorer returned invalid network data');
            }
            return { height, difficulty };
        } catch (error) {
            console.warn('Mining explorer unavailable:', url, error);
        }
    }
    throw new Error('Current Pirate Chain network data is unavailable. Please try again later.');
}

async function getUsdPrice() {
    const response = await fetch(priceUrl);
    if (!response.ok) throw new Error(`Price API returned ${response.status}`);
    const data = (await response.json())['pirate-chain'];
    const price = Number(data && data.usd);
    const updated = Number(data && data.last_updated_at);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(updated) || Date.now() / 1000 - updated > 86400) {
        throw new Error('ARRR/USD quote is unavailable or stale');
    }
    return price;
}

function estimateMining(input, network, price) {
    const blockReward = 256 / Math.pow(2, Math.floor(network.height / 388885));
    // Equihash 200,9 difficulty in this explorer corresponds to 16 expected
    // solutions per difficulty unit; 60 seconds is Pirate Chain's target block time.
    const networkSolutionsPerSecond = network.difficulty * 16 / 60;
    const rewardsPerDay = (input.hashrate * 1000 / networkSolutionsPerSecond) * 1440 * blockReward;
    const electricityPerDay = input.power / 1000 * 24 * input.cost;
    const revenuePerDay = price === null ? null : rewardsPerDay * price;
    const feesPerDay = revenuePerDay === null ? null : revenuePerDay * input.fee / 100;
    const profitPerDay = revenuePerDay === null ? null : revenuePerDay - feesPerDay - electricityPerDay;
    return { rewardsPerDay, electricityPerDay, revenuePerDay, feesPerDay, profitPerDay };
}

function renderMiningResults(result, price) {
    const tbody = document.querySelector('#result-table tbody');
    tbody.replaceChildren();
    for (const [period, days] of [['day', 1], ['week', 7], ['month', 30.5], ['year', 365]]) {
        const row = tbody.insertRow();
        const values = [period, arrr.format(result.rewardsPerDay * days),
            result.revenuePerDay === null ? '—' : usd.format(result.revenuePerDay * days),
            result.feesPerDay === null ? '—' : usd.format(result.feesPerDay * days),
            usd.format(result.electricityPerDay * days),
            result.profitPerDay === null ? '—' : usd.format(result.profitPerDay * days)];
        values.forEach(value => { row.insertCell().textContent = value; });
        if (result.profitPerDay !== null) row.lastElementChild.className = result.profitPerDay < 0 ? 'red-hl' : 'green-hl';
    }
    document.getElementById('result-area').style.display = 'block';
    document.getElementById('instructions-area').style.display = 'none';
    document.getElementById('result-note').textContent = price === null
        ? 'The ARRR/USD quote is unavailable, so revenue, fees and profit cannot be estimated right now.'
        : `Based on an ARRR/USD quote of ${usdQuote.format(price)}. Rewards are before pool fees; profit subtracts pool fees and electricity.`;
}

function setupMiningCalculator() {
    const form = document.getElementById('calcForm');
    const status = document.getElementById('mining-status');
    const button = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const input = Object.fromEntries(['hashrate', 'power', 'cost', 'fee'].map(key => [key, Number(form.elements[key].value)]));
        if (input.hashrate <= 0 || input.power < 0 || input.cost < 0 || input.fee < 0 || input.fee > 100 ||
            Object.values(input).some(value => !Number.isFinite(value))) {
            status.textContent = 'Enter a positive hashrate, nonnegative power and energy cost, and a pool fee from 0 to 100%.';
            return;
        }
        button.disabled = true;
        status.textContent = 'Loading current network data and ARRR price…';
        try {
            const [network, priceResult] = await Promise.all([getNetworkInfo(), getUsdPrice().catch(() => null)]);
            const result = estimateMining(input, network, priceResult);
            renderMiningResults(result, priceResult);
            status.textContent = priceResult === null ? 'Network estimate ready; USD quote unavailable.' : 'Estimate ready.';
        } catch (error) {
            status.textContent = error.message;
            document.getElementById('result-area').style.display = 'none';
            document.getElementById('instructions-area').style.display = 'block';
        } finally {
            button.disabled = false;
        }
    });
}

// stats websocket 
let lastheight = 0;
let nexthalvingheight = 0;

// notify user halvening occured
function halvening(newera) {
    // update data
    getHeight();

    //launch fireworks
    let celebrate = document.getElementById("celebrate");
    celebrate.style.display = "block";
    celebrate.innerHTML = "<img src='" + BASEURL + "assets/img/animations/pirate-chain-mining-fireworks-animation.webp' alt='' width='720' height='405' decoding='async' />";
};

// coundown timer
var seconds = 23333100;   
function timer() {
    var days        = Math.floor(seconds/24/60/60);
    var hoursLeft   = Math.floor((seconds) - (days*86400));
    var hours       = Math.floor(hoursLeft/3600);
    var minutesLeft = Math.floor((hoursLeft) - (hours*3600));
    var minutes     = Math.floor(minutesLeft/60);
    var remainingSeconds = seconds % 60;
    function pad(n) {
        return (n < 10 ? "0" + n : n);
    }
    document.getElementById('days').innerText = pad(days);
    document.getElementById('hours').innerText = pad(hours);
    document.getElementById('mins').innerText = pad(minutes);
    document.getElementById('secs').innerText = pad(remainingSeconds);
      
    // if less than 0 seconds on timer
    if (seconds == 0) {        
        document.getElementById('anymoment').style.display = "block";
    };
    seconds--;        
};       

// when a new height is recieved, update the HTML
function update(height) {
    // define some vars
    height = Number(height);
    if (!Number.isFinite(height) || height <= 0) return;
    lastheight = height;
    let block_time = 60;
    let halving_blocks = 388885;     
    let starting_subsidy = 256;

    //some maths   
    let average_halving_days = (halving_blocks * block_time)/60/60/24; //seconds/mins/hours
    let halving_progress = height / halving_blocks;
    let era = Math.floor(halving_progress);
    let next_era = era + 1;
    let current_subsidy = starting_subsidy / Math.pow(2, era);
    let next_halving_block = halving_blocks * next_era;
    let next_halving_blocks = next_halving_block - height;
    let next_halving_seconds = next_halving_blocks * block_time;

    let timenow = Date.now();
    let halvingtime = timenow + (next_halving_seconds * 1000);
    var halvingdate = new Date(halvingtime);

    let progress = halving_blocks - next_halving_blocks;  
    let progress_percent = ((progress / 388885) * 100).toFixed(2) + "%";

    // insert data into elements
    
    document.getElementById("subsidy").innerText = current_subsidy;
    document.getElementById("next_halving_block").innerText = next_halving_block.toLocaleString('en-US');
    document.getElementById("next_halving_date").innerText = halvingdate.toLocaleString();
    document.getElementById("progress").innerText = progress.toLocaleString('en-US');
    document.getElementById("remaining").innerText = next_halving_blocks.toLocaleString('en-US');
    document.getElementById("bar").style.width = progress_percent;
    document.getElementById("progress_percent").innerText = progress_percent;
    // start countdown loop
    seconds = next_halving_seconds;

 

    document.getElementById("height").innerText = height.toLocaleString('en-US');

    // if block is new era, put on a show
    if (height == nexthalvingheight){
        halvening(era);
    }
    nexthalvingheight = next_halving_block;
};

// get current height from explorer API
async function getHeight() {
    try {
        const network = await getNetworkInfo();
        update(network.height);
    } catch (error) {
        console.warn(error.message);
    }
};

// should we wait to run everything till DOM? 
document.addEventListener("DOMContentLoaded", function(){   
    setupMiningCalculator();
    const loadScript = (path) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = BASEURL + path;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    const startRipples = async () => {
        if (window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse), (max-width: 800px)').matches) return;
        try {
            await loadScript('assets/js/jquery.min.js');
            await loadScript('assets/js/ripples.js');
            jQuery('#rippled').ripples({
                resolution: 512,
                dropRadius: 20,
                perturbance: 0.02,
            });
        } catch (error) {
            console.warn('Water animation unavailable:', error);
        }
    };
    if ('requestIdleCallback' in window) {
        requestIdleCallback(startRipples, { timeout: 2000 });
    } else {
        setTimeout(startRipples, 0);
    }

    // call the API and get the current data
    getHeight();
    setInterval(getHeight, 60000);

    // start the coundown timer
    var countdownTimer = setInterval(timer, 1000);

});
