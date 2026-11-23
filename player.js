'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const rows = window.solarObservations;
  const button=$('play'), reset=$('reset'), status=$('status');
  const exportButtons = [...document.querySelectorAll('[data-format]')];
  const exportStatus = $('export-status');
  if(!Array.isArray(rows) || !rows.length) {
    exportButtons.forEach(control => {control.disabled=true;});
    button.disabled=true;
    status.textContent='The observation data could not load. Reload the page to try again.';
    return;
  }
  const points=rows.map(day=>SolarScore.position(day.date));
  const format=new Intl.DateTimeFormat('en',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const pretty=date=>format.format(new Date(date+'T12:00:00Z'));
  const canvas=$('chart'), disk=$('disk');
  const dateInput=$('date');
  const last=rows.at(-1).date;
  const firstOfMonth=last.slice(0,8)+'01';
  dateInput.min=rows[0].date; dateInput.max=last; dateInput.value=firstOfMonth;
  $('span').textContent=`${pretty(rows[0].date)} – ${pretty(last)} · UTC`;
  if(last!==new Date().toISOString().slice(0,10)) {
    $('span').append(' · Archived observations');
    $('origin').options[0].textContent='First day of the final month shown';
  }
  let current=null, context, audio, buffer, source, playing=false, busy=false;
  let offset=0, started=0, frame=0, playbackRequest=0, route=[];
  let selectedDays=new Set();
  let selection=new AbortController(), preparation=null, exporting=false;
  const masterGain=.65;
  const rate=24000;
  const drawChart = SolarVisuals.chart(canvas, points, rows, () => ({current,selectedDays}));
  const drawDisk = SolarVisuals.disk(disk, () => rows[current]);
  const dial = $('play-dial');
  const playLabel = $('play-label');
  function labelPlay(label) {
    playLabel.textContent=label;
    button.setAttribute('aria-label',label);
    button.title=label;
  }
  function show(index) {
    current=index;const row=rows[index], pos=points[index];
    $('graph-date').textContent=pretty(row.date);
    $('day').textContent=pretty(row.date);
    const readout=row.spots ? `${row.spots.length} detected dark ${row.spots.length===1?'feature':'features'} · image at ${row.time.slice(11)} UTC` : 'Missing observation · silent beat';
    $('spots').textContent=readout;
    disk.setAttribute('aria-label',`Solar disk for ${pretty(row.date)}. ${readout}.`);
    canvas.setAttribute('aria-label',`Figure eight, ${pretty(row.date)}. Declination ${pos.y.toFixed(1)} degrees, equation of time ${pos.x.toFixed(1)} minutes.`);
    const image=$('image-link');image.hidden=!row.id;
    if(row.id)image.href=`https://api.helioviewer.org/v2/downloadImage/?id=${row.id}&width=768&type=png`;
    else image.removeAttribute('href');
    window.SolarReceiver?.observe(row);
    drawChart();drawDisk();
  }
  function clearReadout() {
    current=null;
    $('graph-date').textContent='No date selected';
    $('day').textContent='—'; $('spots').textContent='Awaiting a starting date.';
    $('image-link').hidden=true; $('image-link').removeAttribute('href');
    $('coverage').hidden=true; $('score-length').textContent='';
    $('timeline').value=0; dial.style.setProperty('--progress','0turn'); $('elapsed').textContent='—';
    disk.setAttribute('aria-label','Solar disk awaiting a starting date');
    canvas.setAttribute('aria-label','Annual solar path. Choose a starting date to display the score.');
    window.SolarReceiver?.observe({});
    drawChart();drawDisk();
  }
  function describeRoute() {
    const count=route.length;
    const observed=route.filter(index=>rows[index].spots).length;
    const excerpt=count<rows.length;
    $('score-length').textContent=`${count}-day ${excerpt?'excerpt':'score'}`;
    $('observed-count').textContent=`${observed} observed`;
    $('missing-count').textContent=`${count-observed} missing`;
    $('year-context').hidden=!excerpt;
    $('coverage').hidden=false;
  }
  function stopSource() {
    if(source) {source.onended=null;try{source.stop();}catch{}source.disconnect();source=null;}
    playing=false;button.dataset.playing='false';window.SolarReceiver?.track(false);cancelAnimationFrame(frame);
  }
  function updateTime(t) {
    const pace=Number($('pace').value);
    const length=route.length/pace;
    const index=Math.min(route.length-1,Math.floor(t*pace));
    if(route[index]!==current)show(route[index]);
    const progress=Math.min(t,length)/length;
    $('timeline').value=progress; dial.style.setProperty('--progress',`${progress}turn`);
    $('elapsed').textContent=`${Math.min(t,length).toFixed(1)} / ${length.toFixed(1)} s`;
  }
  function allowExports(enabled) {
    exportButtons.forEach(control => {control.disabled=!enabled;});
  }
  function setup() {
    selection.abort(); selection=new AbortController();
    playbackRequest++; busy=false; exporting=false; preparation=null;
    stopSource(); buffer=null; offset=0; route=[]; exportStatus.textContent='';
    const custom=$('origin').value==='custom'; $('custom').hidden=!custom;
    const date=custom ? dateInput.value : firstOfMonth;
    const start=rows.findIndex(day=>day.date===date);
    reset.disabled=true; labelPlay('Play score');
    button.disabled=start<0; allowExports(start>=0);
    dateInput.setAttribute('aria-invalid',String(start<0));
    $('date-error').hidden=start>=0;
    if(start<0) {
      selectedDays.clear();clearReadout();
      $('date-error').textContent=`Choose a date from ${pretty(rows[0].date)} through ${pretty(last)}.`;
      status.textContent='Choose a starting date in Score settings.';
      return;
    }
    route=SolarScore.makeRoute(rows.length,start,$('route').value);
    if($('pace').value==='1')route=route.slice(0,30);
    selectedDays=new Set(route);describeRoute();
    show(start);updateTime(0);status.textContent='';
  }
  async function render(ordered,pace,mode,signal) {
    const result=new AudioBuffer({numberOfChannels:2,length:Math.round(ordered.length*rate/pace),sampleRate:rate});
    const channels=[result.getChannelData(0),result.getChannelData(1)];
    for(let i=0;i<ordered.length;i++) {
      signal.throwIfAborted();
      SolarScore.renderDay(channels,rate,ordered,i,pace,mode);
      if(i%18===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    signal.throwIfAborted();
    return result;
  }
  function selectedBuffer() {
    if(!preparation) {
      const signal=selection.signal;
      preparation=render(route.map(i=>rows[i]),Number($('pace').value),$('mode').value,signal).catch(error=>{
        if(!signal.aborted)preparation=null;
        throw error;
      });
    }
    return preparation;
  }
  function tick() {
    if(!playing)return;updateTime(context.currentTime-started);
    frame=requestAnimationFrame(tick);
  }
  async function play() {
    if(busy)return;
    if(playing) {
      offset=Math.min(buffer.duration,context.currentTime-started);stopSource();updateTime(offset);
      labelPlay('Resume');status.textContent='Paused.';return;
    }
    const request=++playbackRequest;busy=true;button.disabled=true;
    try {
      document.querySelectorAll('audio').forEach(clip=>clip.pause());
      if(!context) {
        context=new AudioContext();audio=context.createGain();audio.gain.value=masterGain;audio.connect(context.destination);
      }
      await context.resume();if(request!==playbackRequest)return;
      if(!buffer){status.textContent='Preparing the score…';const ready=await selectedBuffer();if(request!==playbackRequest)return;buffer=ready;}
      if(offset>=buffer.duration)offset=0;
      source=context.createBufferSource();source.buffer=buffer;source.connect(audio);
      source.onended=()=>{
        stopSource();updateTime(buffer.duration);offset=0;labelPlay('Play again');status.textContent='Finished.';
      };
      started=context.currentTime-offset;source.start(0,offset);playing=true;reset.disabled=false;
      labelPlay('Pause');button.dataset.playing='true';window.SolarReceiver?.track(true);status.textContent='Playing.';tick();
    } catch {if(request===playbackRequest){stopSource();status.textContent='Audio could not start. Try playing the score again.';labelPlay('Play score');}}
    finally {if(request===playbackRequest){busy=false;button.disabled=false;}}
  }
  async function exportPlayback(format) {
    if(exporting || !route.length)return;
    const signal=selection.signal;
    const filename=`solar-${rows[route[0]].date}-${$('route').value}-${$('mode').value}-${$('pace').value}dps.${format}`;
    const type=format.toUpperCase();
    exporting=true;allowExports(false);exportStatus.textContent=`Preparing ${type}…`;
    try {
      const rendered=await selectedBuffer();signal.throwIfAborted();
      const file=await SolarExport.encode(rendered,format,masterGain,signal,percent=>{
        exportStatus.textContent=`Encoding ${type} · ${percent}%`;
      });
      signal.throwIfAborted();SolarExport.download(file,filename);exportStatus.textContent=`${type} download started.`;
    } catch {
      if(!signal.aborted)exportStatus.textContent=`Could not export ${type}. Please try again.`;
    } finally {
      if(!signal.aborted){exporting=false;allowExports(true);}
    }
  }
  for(const id of ['origin','date','route','mode','pace'])$(id).addEventListener('change',setup);
  button.addEventListener('click',play);reset.addEventListener('click',setup);
  exportButtons.forEach(control=>control.addEventListener('click',()=>exportPlayback(control.dataset.format)));
  const clips=[...document.querySelectorAll('audio')];
  clips.forEach(clip=>clip.addEventListener('play',()=>{
    if(playing)play();else if(busy)setup();
    clips.filter(other=>other!==clip).forEach(other=>other.pause());
  }));
  $('method-link').addEventListener('click',()=>{$('method').open=true;});
  setup();
})();
