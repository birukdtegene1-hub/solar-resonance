'use strict';
// Encode the player's stereo master into a downloadable file, even from file://.
const SolarExport = (() => {
  const yieldToPage = () => new Promise(resolve => setTimeout(resolve, 0));
  function pcm(sample, gain) {
    const value = Math.max(-1, Math.min(1, sample * gain));
    return Math.round(value * (value < 0 ? 32768 : 32767));
  }
  function wavHeader(frames, rate) {
    const bytes = new ArrayBuffer(44);
    const header = new DataView(bytes);
    function tag(at, value) {
      for (let i=0; i<value.length; i++) header.setUint8(at+i, value.charCodeAt(i));
    }
    tag(0,'RIFF'); header.setUint32(4,36 + frames*4,true); tag(8,'WAVE');
    tag(12,'fmt '); header.setUint32(16,16,true); header.setUint16(20,1,true);
    header.setUint16(22,2,true); header.setUint32(24,rate,true); header.setUint32(28,rate*4,true);
    header.setUint16(32,4,true); header.setUint16(34,16,true); tag(36,'data'); header.setUint32(40,frames*4,true);
    return bytes;
  }
  async function encode(buffer, format, gain, signal, report) {
    const left=buffer.getChannelData(0), right=buffer.getChannelData(1);
    const mp3=format==='mp3';
    const encoder=mp3 ? new lamejs.Mp3Encoder(2, buffer.sampleRate, 128) : null;
    const parts=mp3 ? [] : [wavHeader(buffer.length,buffer.sampleRate)];
    const block=mp3 ? 1152 : 32768;
    let lastYield=performance.now();
    for (let at=0; at<buffer.length; at+=block) {
      signal.throwIfAborted();
      const size=Math.min(block, buffer.length-at);
      if (mp3) {
        const l=new Int16Array(size), r=new Int16Array(size);
        for (let i=0; i<size; i++) {l[i]=pcm(left[at+i],gain); r[i]=pcm(right[at+i],gain);}
        const bytes=encoder.encodeBuffer(l,r);
        if(bytes.length) parts.push(bytes);
      } else {
        const data=new DataView(new ArrayBuffer(size*4));
        for (let i=0; i<size; i++) {
          data.setInt16(i*4,pcm(left[at+i],gain),true);
          data.setInt16(i*4+2,pcm(right[at+i],gain),true);
        }
        parts.push(data.buffer);
      }
      if(performance.now()-lastYield>=18) {
        report(Math.floor((at+size)*100/buffer.length));
        await yieldToPage(); lastYield=performance.now();
      }
    }
    signal.throwIfAborted();
    if(mp3) parts.push(encoder.flush());
    return new Blob(parts,{type:mp3?'audio/mpeg':'audio/wav'});
  }
  function download(blob, filename) {
    const url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url; link.download=filename; document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  return {encode,download};
})();
