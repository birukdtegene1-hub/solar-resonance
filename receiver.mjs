import {dish} from '@lucasmarkes/hairline';

const host = document.querySelector('#receiver');
const target = document.querySelector('#receiver-gl');
const dateReadout = document.querySelector('#receiver-readout');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const receiver = dish(host, {
  theme:'dark',
  label:'Steerable illustration showing detected sunspots on a receiver dish'
});
const svg = host.querySelector('svg');
const rim = svg.querySelector('path.nf.hi');
const ns = 'http://www.w3.org/2000/svg';
const aperture = document.createElementNS(ns, 'g');
aperture.setAttribute('class','solar-aperture');
const markings = document.createElementNS(ns,'path');
markings.setAttribute('d','M-.92 0H.92 M0 -.92V.92 M-.69 0a.69 .69 0 1 0 1.38 0a.69 .69 0 1 0 -1.38 0 M-.32 0a.32 .32 0 1 0 .64 0a.32 .32 0 1 0 -.64 0');
const detections = document.createElementNS(ns,'g');
aperture.append(markings,detections);
if (rim) rim.after(aperture);

let spots = null;
let projection;
let tracking = false;
let visible = false;
let pending = 0;
const palette = {fill:'#1e1e1b', bright:'#f5e9d5', edge:'#bdb5a6', mid:'#898479', dim:'#5e5a51', spot:'#f58a68'};

// Hairline 0.5.1 provides projected M/L/Z contours. Draw the same geometry in
// WebGL and retain Hairline's SVG when a WebGL context is unavailable.
function contours(data) {
  return (data.match(/M[^M]+/g) || []).map(path => {
    const values = (path.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    const points = [];
    for (let i=0; i<values.length; i+=2) points.push([values[i],values[i+1]]);
    return {points,closed:path.endsWith('Z')};
  });
}

function alignAperture() {
  const points = contours(rim?.getAttribute('d') || '')[0]?.points;
  if (!points?.length || points.length % 4) return;
  const first = points[0], quarter = points[points.length/4], opposite = points[points.length/2];
  const x = (first[0]+opposite[0])/2, y = (first[1]+opposite[1])/2;
  projection = [first[0]-x,first[1]-y,quarter[0]-x,quarter[1]-y,x,y];
  aperture.setAttribute('transform',`matrix(${projection.join(' ')})`);
}

const paint = SolarVisuals.surface(target, ({polygon,line,dot}) => {
  for (const node of svg.querySelectorAll('path,ellipse,.solar-aperture')) {
    if (node === aperture) {
      if (!projection || !spots) continue;
      const [a,b,c,d,px,py] = projection;
      const place = ([x,y]) => [px+a*x+c*y,py+b*x+d*y];
      for (const ring of [.32,.69]) line(SolarVisuals.ellipse(0,0,ring,ring,48).map(place),.7,palette.mid,true);
      line([[-.92,0],[.92,0]].map(place),.7,palette.mid);
      line([[0,-.92],[0,.92]].map(place),.7,palette.mid);
      for (const [x,y,area] of spots) {
        const radius = Math.min(.085,.03+Math.sqrt(area)*.003);
        polygon(SolarVisuals.ellipse(x,-y,radius).map(place),palette.spot);
      }
    } else if (!aperture.contains(node)) {
      const classes = node.classList;
      if (node.localName === 'ellipse') {
        const [cx,cy,rx,ry] = ['cx','cy','rx','ry'].map(key => Number(node.getAttribute(key)));
        dot(cx,cy,rx,classes.contains('off') ? palette.dim : palette.edge,ry);
      } else {
        const shade = classes.contains('hi') ? palette.bright : classes.contains('sil') ? palette.edge : classes.contains('lo') ? palette.dim : palette.mid;
        for (const {points,closed} of contours(node.getAttribute('d') || '')) {
          if (closed && !classes.contains('nf')) polygon(points,palette.fill);
          line(points,1.05,shade,closed);
        }
      }
    }
  }
}, {fallback:false,viewport:[400,320]});

function refresh() {
  if (!visible || pending) return;
  pending = requestAnimationFrame(() => {
    pending=0;
    alignAperture();
    paint();
  });
}
const geometryChanges = new MutationObserver(refresh);
geometryChanges.observe(svg,{subtree:true,childList:true,attributes:true,attributeFilter:['d','cx','cy']});
new IntersectionObserver(([entry]) => {
  visible=entry.isIntersecting;
  refresh();
}).observe(host);

let aimX=.5, aimY=.5;
host.addEventListener('keydown',event => {
  const delta = {ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]}[event.key];
  if (!delta) return;
  event.preventDefault();
  aimX=Math.min(1,Math.max(0,aimX+delta[0]));
  aimY=Math.min(1,Math.max(0,aimY+delta[1]));
  const rect=host.getBoundingClientRect();
  host.dispatchEvent(new PointerEvent('pointermove',{
    pointerType:'mouse',clientX:rect.left+rect.width*aimX,clientY:rect.top+rect.height*aimY
  }));
});
host.addEventListener('blur',() => {
  aimX=.5; aimY=.5;
  host.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));
});

window.SolarReceiver = {
  observe(row) {
    spots = row.spots ?? null;
    host.classList.toggle('no-frame', !spots);
    detections.replaceChildren(...(spots || []).map(([x,y,area]) => {
      const spot=document.createElementNS(ns,'circle');
      spot.setAttribute('cx',x);spot.setAttribute('cy',-y);
      spot.setAttribute('r',Math.min(.085,.03+Math.sqrt(area)*.003));
      return spot;
    }));
    dateReadout.textContent = spots ? `${spots.length} detected ${spots.length===1?'feature':'features'}` : 'No observation';
    receiver.update({intensity:0.3+Math.min(0.7,Math.sqrt((spots?.length || 0)/30)),play:tracking && Boolean(spots) && !reduceMotion.matches});
    refresh();
  },
  track(active) {
    tracking = active;
    receiver.update({play:active && Boolean(spots) && !reduceMotion.matches});
  }
};
