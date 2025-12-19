
# This repository is a demo static website for the Pirate Chain Network

The demo can be veiwed at [https://s-fff.github.io/pirate.black/](https://s-ftf.github.io/pirate.black/). 
<br /><br />
The main intent of this demo was to create a static website that is automated, low maintenence, and open to the community. 

- Pure HTML, CSS, and minimal JS 
- low maintenance, no plugins or anything to keep updated
- small, only aroudn 12mb
- Hostable on github (no server costs or maintenence required)
- sits nicely behind cloudflare or other free CDN for a very fast site (once optimized)
- git provides Chain of custody, versioning, and handles permissions (no more wondering who has access)
- ultra portable - can be hosted anywhere - no database to move
- can be hosted easily on alternative networks like IPFS or Qortal
- disaster resilient - if a host is shutdown, the DNS can simply be pointed to any other copy (gitlab mirror for example)
- makes the website opensource open to the copmmunity being on git
- If self-hosted, can use git hook so source remains open
- becuase on git and simple HTML so anybody can PR
- automated, all links and content  update automatically so no manual interaction is needed - helps prevent site from looking abandoned in slow times
- Jekeyl was used for templating and extra functionality
-A translation system was built using Jekyll and python scripts which scrape the english version and use DeepL API to create transalted static pages in the `lang` directory. 

The drawback from going to a static website however is that there is no database for things like a self hosted blog platform, or CMS for people to make changes to content graphically. Ultimately it was decided to go with a more complete server with a site and blog system built on wordpress
<br /><br />
## ## This Demo is UNFINISHED. Some features were not completed. Do not rely on the scripts or any info on the website.

<br /><br />
<hr />
<br /><br />

<img src="assets/img/logo/Pirate_Logo_WG.svg" style="width: 300px;">

# PIRATE.BLACK WEBSITE
This repository contains the source of the Pirate Chain official website hosted at [https://pirate.black](https://pirate.black). 

<br/>

>Pirate Chain is a community project, so we invite your feedback and
> improvement ideas using the GitHub issues. 
> 
> Please contact us on the Pirate Chain Discord server to discuss any
> Pull Requests or other suggestions.
> [https://pirate.black/discord](https://pirate.black/discord.html)

<br/>
<hr />
<br/>

## SITE OPERATION AND MAINTENANCE

***The following are notes for maintaining and operating the website***<br/>
The pirate.black website has been written in primarily HTML and CSS. Javascript is also used sparingly. Jquery and other external packages should be avoided where possible.

<br/>  

## Community Page
The community page is a live feed of the most recent videos posted to the following playlists on the [Official Pirate Chain YouTube channel](https://www.youtube.com/c/piratechain). 
* [Pirate Music Playlist](https://www.youtube.com/watch?v=RhRWM1WW6ak&list=PLgEMYwvTcDT4qBIZCMpTgiTOCSRqU1KtL)
* [Events Playlist](https://www.youtube.com/watch?v=RGplTBYULyE&list=PLgEMYwvTcDT4AqQXvh2fVmJX_kIVMAT7Q)
* [Interviews Playlist](https://www.youtube.com/watch?v=LPyIP8DbkDg&list=PLgEMYwvTcDT6N_jJrA_Jo8m9twRwolHK-)
* [Monthy Updates Playlist](https://www.youtube.com/watch?v=dyz0ltiafWk&list=PLgEMYwvTcDT54FsOk4yVWkJZ4i3Xcz1mM)
* [ARRR Community Playlist](https://www.youtube.com/watch?v=248NO7p2h8w&list=PLgEMYwvTcDT5V1RiSoPh1RheOgDYJ88jK)
* [Daily Dose of Pirate chain channel](https://www.youtube.com/@DailyDoseOfPirateChain)

<br/>

## Branding Page
All the images displayed are linked from the mediakit repository at [https://github.com/PirateNetwork/mediakit](https://github.com/PirateNetwork/mediakit). Any changes to the naming scheme of the logos and brand art will break the images and switching functionality on this page.

<br/>

## Whitepaper
The whitepaper is a iframe that refers to the whitepaper hosted at [https://github.com/PirateNetwork/pirate-docs/tree/master/assets/whitepaper](https://github.com/PirateNetwork/pirate-docs/tree/master/assets/whitepaper). Any new versions of the whitepaper must use the name: `Pirate_Chain_White_Paper.pdf`, or a update to the iframe source on this page will be required

<br/>

## Contact email address
The email address on the `contact.html` page is obscured from scrapers. The contact email address is stored in the `data-contact` element encoded in base64 and decoded with JavaScript.
```HTML
<a  id="email"
  href="#"
  data-contact="bWFya2V0aW5nQHBpcmF0ZS5ibGFjaw=="
  data-subj="Q29udGFjdCBmcm9tIHBpcmF0ZS5ibGFjayB3ZWJzaXRl"
  onfocus="reveal(this.dataset.contact, this.dataset.subj);"
>
```
<br />
<hr />
<img src="assets/img/logo/Pirate_Logo_Wordmark_Gold.svg" style="width:150px;margin:40px auto;display:block;">
