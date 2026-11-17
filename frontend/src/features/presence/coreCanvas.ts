import type { RefObject } from 'react';
import type { CoreState } from './IntelligenceCore';
import { audioLevel, easeMotion, profiles } from './coreMotion';
type Point = [number, number, number];
/** Perspective-projected 3D curves for devices where WebGL is unavailable. */
export function createCanvasCore(canvas: HTMLCanvasElement, state: () => CoreState, analyser: RefObject<AnalyserNode | null>) {
  const context = canvas.getContext('2d'); if (!context) return () => {};
  const ctx: CanvasRenderingContext2D = context;
  const curves: { points: Point[]; weight: number; orbit: number }[] = [];
  for (let j=0;j<44;j++) {
    const phase=j/44*Math.PI*2;
    curves.push({weight:j%4===0?1:.48,orbit:-1,points:Array.from({length:121},(_,i)=>{
      const t=.04+i/120*(Math.PI-.08), twist=phase+.19*Math.sin(t*3+phase*2)+.12*Math.cos(t*5-phase),r=1+.018*Math.sin(t*6+phase*3);
      return [Math.sin(t)*Math.cos(twist)*r,Math.cos(t)*r,Math.sin(t)*Math.sin(twist)*r];
    })});
  }
  for(let j=1;j<15;j++) {
    const theta=j/15*Math.PI;
    curves.push({weight:j%3===0?.65:.27,orbit:-1,points:Array.from({length:145},(_,i)=>{
      const t=i/144*Math.PI*2,r=Math.sin(theta)*(1+.012*Math.sin(t*7+theta));return [r*Math.cos(t),Math.cos(theta),r*Math.sin(t)];
    })});
  }
  for(let j=0;j<9;j++) {
    const phase=j/9*Math.PI*2;
    curves.push({weight:.45,orbit:-2,points:Array.from({length:121},(_,i)=>{
      const t=i/120*Math.PI*2,r=.47+.11*Math.cos(t*3+phase);return [Math.cos(t)*r,Math.sin(t)*Math.cos(phase)*r,Math.sin(t)*Math.sin(phase)*r];
    })});
  }
  for(let j=0;j<3;j++)curves.push({weight:.8,orbit:j,points:Array.from({length:101},(_,i)=>{
    const t=i/100*(j===1?3.9:2.2)+j*2.1,r=1.15+j*.045;return [Math.cos(t)*r,Math.sin(t)*r,0];
  })});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),motion={...profiles.standby},bins=new Uint8Array(256);
  let width=1,raf=0,last=0,rendered=0,clock=0,angle=0,level=0;
  const resize=()=>{width=canvas.clientWidth;const dpr=Math.min(devicePixelRatio||1,1.65);canvas.width=width*dpr;canvas.height=width*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function rotate(p:Point,rx:number,ry:number,rz:number):Point {
    const [x,y,z]=p,yy=y*Math.cos(rx)-z*Math.sin(rx),zz=y*Math.sin(rx)+z*Math.cos(rx),xx=x*Math.cos(ry)+zz*Math.sin(ry),z2=-x*Math.sin(ry)+zz*Math.cos(ry);
    return [xx*Math.cos(rz)-yy*Math.sin(rz),xx*Math.sin(rz)+yy*Math.cos(rz),z2];
  }
  function render(now:number){
    raf=requestAnimationFrame(render);if(document.hidden){last=now;return;}if(now-rendered<(reduced.matches?120:32))return;
    const dt=last?Math.min((now-last)/1000,.1):0;last=now;rendered=now;
    const mode=state();easeMotion(motion,profiles[mode],dt);let target=0;
    if((mode==='listening'||mode==='speaking')&&analyser.current){analyser.current.getByteTimeDomainData(bins);target=audioLevel(bins);}
    level+=(target-level)*(1-Math.exp(-dt*(target>level?14:5)));
    if(!reduced.matches){clock+=dt;angle+=dt*motion.speed;}
    const energy=reduced.matches?level*.35:level,scale=width*.326;
    ctx.clearRect(0,0,width,width);ctx.save();ctx.translate(width/2,width/2);ctx.globalCompositeOperation='lighter';
    const projected=curves.map(curve=>{
      const points=curve.points.map(p=>{
        const wave=Math.sin(p[1]*5+clock*1.4)+Math.sin(p[2]*6-clock*.7),size=1+wave*(.006+energy*.022)+motion.spread*.025;
        let q:Point=[p[0]*size,p[1]*size,p[2]*size];
        if(curve.orbit>=0)q=rotate(q,.55+curve.orbit*.71,curve.orbit*.9,.35+angle*(curve.orbit%2?-.75:.6));
        else {if(curve.orbit===-2)q=rotate(q,-angle*.7,angle*.3,.4);q=rotate(q,.2+Math.sin(clock*.11)*.07,angle,-.16);}
        const perspective=4.7/(4.7-q[2]);return [q[0]*scale*perspective,-q[1]*scale*perspective,q[2]] as Point;
      });return {points,weight:curve.weight};
    });
    const segments:{a:Point;b:Point;weight:number}[]=[];
    for(const curve of projected)for(let i=1;i<curve.points.length;i++)segments.push({a:curve.points[i-1],b:curve.points[i],weight:curve.weight});
    segments.sort((a,b)=>a.a[2]-b.a[2]);ctx.lineWidth=1.15;
    for(const {a,b,weight} of segments){
      const front=(a[2]+1.3)/2.6,alpha=(.07+front*front*1.25+energy*.2)*motion.light*weight;
      const r=Math.round(70+front*105+motion.warmth*45),g=Math.round(145+front*85),blue=Math.round(190+front*60-motion.warmth*65);
      ctx.strokeStyle=`rgba(${r},${g},${blue},${alpha})`;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
    }
    const glow=ctx.createRadialGradient(0,0,0,0,0,scale*.45);glow.addColorStop(0,`rgba(138,218,255,${.8*motion.light+energy*.3})`);glow.addColorStop(.07,'rgba(82,182,246,.23)');glow.addColorStop(.25,'rgba(33,126,205,.06)');glow.addColorStop(1,'rgba(20,90,150,0)');ctx.fillStyle=glow;ctx.fillRect(-scale,-scale,scale*2,scale*2);
    if(motion.inward>.05)for(let i=0;i<3;i++){const phase=(clock*.25+i/3)%1,r=scale*(1-phase);ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.strokeStyle=`rgba(97,191,237,${Math.sin(phase*Math.PI)*motion.inward*.22})`;ctx.stroke();}
    for(let j=0;j<4;j++){const r=scale*(.065+j*.023);ctx.beginPath();ctx.ellipse(0,0,r,r*(.5+j*.09),angle*(j%2?-1:1),0,Math.PI*2);ctx.strokeStyle=`rgba(105,198,245,${(.3-j*.045)*motion.light})`;ctx.lineWidth=.8;ctx.stroke();}
    ctx.restore();canvas.dataset.ready='true';
  }
  raf=requestAnimationFrame(render);return()=>{cancelAnimationFrame(raf);observer.disconnect();};
}
