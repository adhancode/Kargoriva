import * as BABYLON from 'babylonjs';
import type { WorldData } from '../data/types';

export interface RouteResult { points: {x:number;z:number}[]; distance: number; }
export class RoutePlanner {
  constructor(private world: WorldData) {}
  route(x1:number,z1:number,x2:number,z2:number): RouteResult {
    const xs=this.world.grid.xs, zs=this.world.grid.zs; const nearest=(x:number,z:number)=>({x:xs.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a,xs[0]),z:zs.reduce((a,b)=>Math.abs(b-z)<Math.abs(a-z)?b:a,zs[0])});
    const a=nearest(x1,z1), b=nearest(x2,z2); const points=[{x:x1,z:z1}]; if(Math.abs(a.x-b.x)>1) points.push({x:a.x,z:a.z}); if(Math.abs(a.z-b.z)>1) points.push({x:a.x,z:b.z}); points.push({x:b.x,z:b.z},{x:x2,z:z2});
    const compact=points.filter((p,i)=>i===0||Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z)>0.5); const distance=compact.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-compact[i].x,p.z-compact[i].z),0); return {points:compact,distance};
  }
}
export interface MinimapState { playerX:number; playerZ:number; playerHeading:number; dc:WorldData['dc']; targets:{x:number;z:number;state:'done'|'active'|'pending';order:number}[]; routePoints:{x:number;z:number}[]; }
export class Minimap {
  private ctx: CanvasRenderingContext2D | null; private world:WorldData;
  constructor(private canvas:HTMLCanvasElement, world:WorldData){this.ctx=canvas.getContext('2d');this.world=world;}
  render(s:MinimapState,_dt:number,fullMap=false):void {
    const c=this.ctx,canvas=this.canvas;if(!c)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    // Render the enlarged minimap at a 1920px backing width on desktop for crisp lines and markers.
    const pixelRatio=Math.min(5,Math.max(window.devicePixelRatio||1,1920/w));
    const pixelWidth=Math.round(w*pixelRatio),pixelHeight=Math.round(h*pixelRatio);
    if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
    c.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    // The minimap follows the player; the expanded map shows the entire city.
    const viewWidth=180,viewHeight=viewWidth*(h/w);
    const bounds=fullMap?this.world.bounds:{
      minX:s.playerX-viewWidth/2,maxX:s.playerX+viewWidth/2,
      minZ:s.playerZ-viewHeight/2,maxZ:s.playerZ+viewHeight/2,
    };
    const sx=w/(bounds.maxX-bounds.minX),sy=h/(bounds.maxZ-bounds.minZ);
    const px=(x:number)=>(x-bounds.minX)*sx,pz=(z:number)=>(z-bounds.minZ)*sy;
    c.clearRect(0,0,w,h);

    // Draw the same green lots, building footprints, and road widths used by the 3D world.
    c.fillStyle='#b9cfa8';c.fillRect(0,0,w,h);
    for(const b of this.world.buildings){
      const x=px(b.x-b.w/2),y=pz(b.z-b.d/2),bw=b.w*sx,bh=b.d*sy;
      c.fillStyle=b.kind==='office'?'#cbd9df':b.kind==='shop'?'#ead4b1':b.kind==='warehouse'?'#c5c9c3':'#e7dfce';
      c.fillRect(x,y,bw,bh);c.strokeStyle='#a6afa9';c.lineWidth=0.8;c.strokeRect(x+0.4,y+0.4,Math.max(0,bw-0.8),Math.max(0,bh-0.8));
    }
    // Road casing and surface follow each in-game segment's actual width.
    c.lineCap='round';c.lineJoin='round';
    for(const r of this.world.roads){
      c.beginPath();c.moveTo(px(r.x1),pz(r.z1));c.lineTo(px(r.x2),pz(r.z2));
      c.strokeStyle='#c3c9c5';c.lineWidth=(r.width+1.8)*((sx+sy)/2);c.stroke();
      c.beginPath();c.moveTo(px(r.x1),pz(r.z1));c.lineTo(px(r.x2),pz(r.z2));
      c.strokeStyle=r.type==='main'?'#f0d28a':'#f7f5ed';c.lineWidth=r.width*((sx+sy)/2);c.stroke();
    }
    // Subtle center markings mirror the road markings in the driving scene.
    c.save();c.setLineDash([3,4]);c.strokeStyle='#d1c6a7';c.lineWidth=0.7;
    for(const r of this.world.roads){if(r.type!=='main')continue;c.beginPath();c.moveTo(px(r.x1),pz(r.z1));c.lineTo(px(r.x2),pz(r.z2));c.stroke();}
    c.restore();

    // Distribution center footprint, matching its position and dimensions in the 3D scene.
    const dcx=s.dc.x-28,dcz=s.dc.z-20;
    c.fillStyle='#7a8990';c.fillRect(px(dcx-17),pz(dcz-12.5),34*sx,25*sy);
    c.strokeStyle='#f4f0df';c.lineWidth=1;c.strokeRect(px(dcx-17),pz(dcz-12.5),34*sx,25*sy);
    c.fillStyle='#ff8a24';c.fillRect(px(s.dc.x)-2.5,pz(s.dc.z)-2.5,5,5);

    // Route sits on top of roads so it remains readable at minimap scale.
    if(s.routePoints.length>1){
      c.beginPath();s.routePoints.forEach((p,i)=>i?c.lineTo(px(p.x),pz(p.z)):c.moveTo(px(p.x),pz(p.z)));
      c.strokeStyle='#fff8e8';c.lineWidth=4;c.stroke();c.strokeStyle='#f28a28';c.lineWidth=2.2;c.stroke();
    }
    for(const t of s.targets){
      const x=px(t.x),y=pz(t.z);
      if(t.state==='done'){
        c.beginPath();c.arc(x,y,2.5,0,Math.PI*2);c.fillStyle='#38a96e';c.fill();
        continue;
      }
      const active=t.state==='active',box=active?8:6;
      if(active){c.beginPath();c.arc(x,y,9,0,Math.PI*2);c.fillStyle='rgba(242,138,40,.2)';c.fill();}
      // Small folded-carton marker with a numbered stop badge.
      c.fillStyle='#5b4631';c.fillRect(x-box/2-0.5,y-box/2+1,box+1,box);
      c.fillStyle=active?'#f28a28':'#d8a765';c.fillRect(x-box/2,y-box/2,box,box);
      c.strokeStyle=active?'#fff3d6':'#fff8e8';c.lineWidth=0.7;c.beginPath();
      c.moveTo(x-box/2,y-box/2);c.lineTo(x,y-0.3);c.lineTo(x+box/2,y-box/2);
      c.moveTo(x,y-0.3);c.lineTo(x,y+box/2);c.stroke();
      c.beginPath();c.arc(x+box/2+2,y-box/2-2,3.2,0,Math.PI*2);c.fillStyle=active?'#17232d':'#35434a';c.fill();
      c.fillStyle='#fff';c.font='bold 5px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(String(t.order),x+box/2+2,y-box/2-2);
    }
    // Vehicle heading 0 faces +Z (down on this north-up canvas); the arrow shape points up by default.
    c.save();c.translate(px(s.playerX),pz(s.playerZ));c.rotate(Math.PI-s.playerHeading);
    c.beginPath();c.arc(0,0,6.5,0,Math.PI*2);c.fillStyle='#f7fbff';c.fill();
    c.fillStyle='#19a9df';c.beginPath();c.moveTo(0,-6);c.lineTo(4.2,4);c.lineTo(0,2.4);c.lineTo(-4.2,4);c.closePath();c.fill();c.restore();
  }
}

