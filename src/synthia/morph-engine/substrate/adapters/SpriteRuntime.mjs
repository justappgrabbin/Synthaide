/** Browser-only sprite interpolation runtime. No backend, no model required. */
export async function loadBitmap(file) {
  if (typeof createImageBitmap === 'undefined') throw new Error('SpriteRuntime requires a browser with createImageBitmap().');
  return createImageBitmap(file);
}

export function inferGrid(width, height, preferredFrameCount=0) {
  // Favor common horizontal/rectangular sheets, then square-ish cells.
  if (preferredFrameCount > 0 && width % preferredFrameCount === 0) {
    return {cols:preferredFrameCount, rows:1, frameWidth:width/preferredFrameCount, frameHeight:height};
  }
  const candidates=[];
  for(let cols=1; cols<=16; cols++) for(let rows=1; rows<=16; rows++) {
    if(width%cols || height%rows) continue;
    const fw=width/cols, fh=height/rows;
    const ratio=Math.max(fw/fh, fh/fw);
    const count=cols*rows;
    if(ratio<=2.5 && count<=128) candidates.push({cols,rows,frameWidth:fw,frameHeight:fh,score:Math.abs(1-ratio)+(count===1?3:0)});
  }
  candidates.sort((a,b)=>a.score-b.score || b.cols*b.rows-a.cols*a.rows);
  return candidates[0] || {cols:1,rows:1,frameWidth:width,frameHeight:height};
}

export function sliceSheet(bitmap, grid) {
  const frames=[];
  for(let r=0;r<grid.rows;r++) for(let c=0;c<grid.cols;c++) {
    frames.push({sx:c*grid.frameWidth, sy:r*grid.frameHeight, sw:grid.frameWidth, sh:grid.frameHeight});
  }
  return frames;
}

export function drawInterpolated(ctx, bitmap, a, b, t, x=0, y=0, opts={}) {
  const w=opts.width||a.sw, h=opts.height||a.sh;
  const bob=(opts.walk||0) * Math.sin(t*Math.PI*2) * h*0.025;
  const sway=(opts.walk||0) * Math.sin(t*Math.PI*2) * 0.035;
  const squash=(opts.express||0) * Math.sin(t*Math.PI) * 0.035;
  ctx.save();
  ctx.translate(x+w/2, y+h/2+bob);
  ctx.rotate(sway);
  ctx.scale(1+squash,1-squash);
  ctx.globalAlpha=1-t;
  ctx.drawImage(bitmap,a.sx,a.sy,a.sw,a.sh,-w/2,-h/2,w,h);
  ctx.globalAlpha=t;
  ctx.drawImage(bitmap,b.sx,b.sy,b.sw,b.sh,-w/2,-h/2,w,h);
  ctx.globalAlpha=1;
  if(opts.talk){
    // Procedural mouth motion when no dedicated mouth frames exist.
    const open=(0.15+0.85*Math.abs(Math.sin((opts.time||0)*14))) * opts.talk;
    ctx.beginPath();
    ctx.ellipse(0,h*0.18,w*0.055,h*(0.008+0.025*open),0,0,Math.PI*2);
    ctx.fillStyle='rgba(20,10,14,.72)';
    ctx.fill();
  }
  ctx.restore();
}

export class SpriteMorphPlayer {
  constructor({canvas, bitmap, frames, fps=12, inbetweens=4}){
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.bitmap=bitmap; this.frames=frames;
    this.fps=fps; this.inbetweens=inbetweens; this.state='idle'; this.running=false; this.time=0; this.frame=0;
    canvas.width=frames[0]?.sw||bitmap.width; canvas.height=frames[0]?.sh||bitmap.height;
  }
  setState(state){ this.state=state; }
  start(){ if(this.running)return; this.running=true; let last=performance.now(); const loop=(now)=>{if(!this.running)return; const dt=(now-last)/1000;last=now;this.update(dt);this.render();requestAnimationFrame(loop)};requestAnimationFrame(loop); }
  stop(){this.running=false;}
  update(dt){this.time+=dt; this.frame=(this.frame+dt*this.fps)%Math.max(1,this.frames.length);}
  render(){
    const n=this.frames.length; if(!n)return;
    const i=Math.floor(this.frame)%n, j=(i+1)%n, t=this.frame-Math.floor(this.frame);
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    drawInterpolated(this.ctx,this.bitmap,this.frames[i],this.frames[j],t,0,0,{
      time:this.time,
      walk:this.state==='walk'?1:0,
      talk:this.state==='talk'?1:0,
      express:this.state==='express'?1:0
    });
  }
}

export async function createSpriteMorphPlayer(file, canvas, options={}){
  const bitmap=await loadBitmap(file);
  const grid=options.grid||inferGrid(bitmap.width,bitmap.height,options.frameCount||0);
  const frames=sliceSheet(bitmap,grid);
  return new SpriteMorphPlayer({canvas,bitmap,frames,fps:options.fps||12,inbetweens:options.inbetweens||4});
}
