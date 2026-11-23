'use strict';
// The browser player and exported clips share this score and synthesizer.
const SolarScore = (() => {
  const DAY = 86400000;
  const SCALE = [0, 2, 4, 6, 7, 9, 11];
  const MELODY = [48, 52, 55, 59, 62, 66, 69, 72, 76, 79, 83];
  const table = Float32Array.from({length:8192}, (_,i) => Math.sin(i * 2 * Math.PI / 8192));
  const limit = (value,low,high) => Math.min(high, Math.max(low,value));

  function position(date) {
    const year = Number(date.slice(0,4));
    const start = Date.UTC(year,0,1);
    const fraction = (Date.parse(date+'T00:00:00Z')-start)/(Date.UTC(year+1,0,1)-start);
    const a = 2*Math.PI*fraction;
    const minutes = 229.18*(.000075+.001868*Math.cos(a)-.032077*Math.sin(a)-.014615*Math.cos(2*a)-.040849*Math.sin(2*a));
    const radians = .006918-.399912*Math.cos(a)+.070257*Math.sin(a)-.006758*Math.cos(2*a)+.000907*Math.sin(2*a)-.002697*Math.cos(3*a)+.00148*Math.sin(3*a);
    return {x:minutes, y:radians*180/Math.PI};
  }
  function makeRoute(length, start, route) {
    return Array.from({length}, (_,i) => {
      const offset = route === 'outward' ? (i%2 ? -(i+1)/2 : i/2) : i;
      return (start+offset+length)%length;
    });
  }
  function seasonalNote(pos) {
    return MELODY[Math.round(limit((pos.y+23.45)/46.9,0,1)*(MELODY.length-1))];
  }
  function chordNote(root, step) {
    const index = SCALE.indexOf(root%12) + step;
    return 12*Math.floor(root/12) + 12*Math.floor(index/7) + SCALE[(index%7+7)%7];
  }
  function addTone(channels, rate, start, duration, midi, gain, pan, voice, color=0) {
    const begin = Math.max(0,Math.round(start*rate));
    const samples = Math.min(Math.round(duration*rate),channels[0].length-begin);
    if(samples < 2) return;
    const step = 8192*440*2**((midi-69)/12)/rate;
    const left = gain*Math.sqrt((1-pan)/2), right = gain*Math.sqrt((1+pan)/2);
    const attack = Math.max(1,Math.min(samples*.22,rate*(voice==='pad'?.045:.009)));
    const release = Math.max(1,Math.min(samples*.42,rate*(voice==='pad'?.14:.065)));
    const decay = Math.exp(-(voice==='pad'?1.4:2.2)/samples);
    const harmonic = voice==='spot' ? .12+.48*color : voice==='lead' ? .22 : .06;
    let phase=0, energy=1;
    for(let i=0;i<samples;i++,phase+=step,energy*=decay) {
      const k=phase|0;
      const envelope=Math.min(1,i/attack,(samples-i-1)/release)*energy;
      const value=(table[k&8191]+harmonic*table[(k*2)&8191]+color*.24*table[(k*3)&8191]) * envelope;
      channels[0][begin+i]+=left*value;
      channels[1][begin+i]+=right*value;
    }
  }
  function renderDay(channels, rate, ordered, i, pace, mode) {
    const day = ordered[i];
    if(!day.spots) return;
    const pos=position(day.date), root=seasonalNote(pos), duration=1/pace, start=i*duration;
    if(!day.spots.length) {
      addTone(channels,rate,start,duration*.78,root,.14,0,'lead');
      return;
    }
    const lateral=limit(pos.x/17,-1,1);
    addTone(channels,rate,start+(.10+.09*lateral)*duration,.75*duration,root,.46,lateral*.78,'lead');
    // A date keeps its melody. Its soft chord tone rings into up to two later active dates.
    let sustain=1;
    while(sustain<3 && ordered[i+sustain]?.spots?.length) sustain++;
    addTone(channels,rate,start,duration*sustain,chordNote(root,-3),.13,-lateral*.42,'pad');
    const spots=[...day.spots].sort((a,b)=>a[0]-b[0]);
    const activity=limit(Math.sqrt(spots.length/24),0,1);
    const pulseCount=Math.min(spots.length,1+Math.round(7*activity));
    const level=.28/Math.sqrt(spots.length);
    spots.forEach(([x,y,area],j) => {
      const relative=limit((x+1)/2,0,1);
      const step=2+Math.round((y+1)*2);
      const pitch=chordNote(root, step) - (area>=22 ? 12:0);
      let onset=.12+.27*relative, length=.55, color=.14, note=pitch;
      if(mode==='pulses') {
        const slot=Math.min(pulseCount-1,Math.floor(j*pulseCount/spots.length));
        onset=.05+slot*.85/pulseCount; length=Math.min(.30,.88/pulseCount);
      } else if(mode==='color') {
        color=activity; note=chordNote(root,2) + (y>0?0:-12);
      } else {
        onset=.06+.12*relative; length=.77;
      }
      addTone(channels,rate,start+onset*duration,length*duration,note,level*(.8+Math.min(.45,Math.sqrt(area)/18)),limit(x,-1,1), 'spot',color);
    });
  }
  function allocate(days,pace,rate) {
    const samples=Math.round(days*rate/pace);
    return [new Float32Array(samples),new Float32Array(samples)];
  }
  return {position, makeRoute, renderDay, allocate, DAY};
})();
if(typeof module!=='undefined' && module.exports) module.exports=SolarScore;
