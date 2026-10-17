import * as BABYLON from 'babylonjs';
import { CHARACTERS } from '../data/config';
import { createCharacterRig, type CharacterRig } from '../character/Character';
import type { NPCSpec, CharacterSpec } from '../data/types';
import type { WorldData } from '../data/types';
import type { GameEngine } from '../engine/GameEngine';
export interface NPCRuntime { spec: NPCSpec; rig: CharacterRig; x:number; z:number; }
interface WalkerRoute { x1:number; z1:number; x2:number; z2:number; }
interface WalkerRuntime { rig:CharacterRig; route:WalkerRoute; phase:number; speed:number; }
export class NPCManager {
  readonly people:NPCRuntime[]=[];
  private walkers:WalkerRuntime[]=[];
  constructor(scene:BABYLON.Scene,engine:GameEngine,world:WorldData){
    const specs:NPCSpec[]=[];
    // Staff DC remain as a small visible team around the loading area.
    specs.push({id:'manager',name:'Hendra Gunawan',role:'manager',title:'Manajer DC',outfit:'#344556',pants:'#212a33',skin:'#c68b59',hair:'#171412',gender:'male',x:-147,z:-78,heading:-Math.PI/2});
    specs.push({id:'sorter1',name:'Sri Wahyuni',role:'sorter',title:'Penyortir Zona A',outfit:'#df7626',pants:'#3a3f45',skin:'#d9a06b',hair:'#241f1c',gender:'female',x:-131,z:-90,heading:Math.PI});
    specs.push({id:'sorter2',name:'Agus Salim',role:'sorter',title:'Penyortir Zona B',outfit:'#38b878',pants:'#2f3a4a',skin:'#8c5a3b',hair:'#101010',gender:'male',x:-120,z:-90,heading:Math.PI});
    specs.push({id:'sorter3',name:'Rina Marlina',role:'sorter',title:'Penyortir Zona C',outfit:'#4da3ff',pants:'#37424e',skin:'#e8b98a',hair:'#241f1c',gender:'female',x:-109,z:-90,heading:Math.PI});
    specs.forEach(n=>{const base=CHARACTERS.find(c=>c.gender===n.gender)!;const c:CharacterSpec={...base,id:n.id,name:n.name,role:n.title,outfit:n.outfit,skin:n.skin,hair:n.hair,pants:n.pants};const rig=createCharacterRig(scene,c,{vest:n.role==='sorter'?'#ffbb38':undefined,nameTag:n.name,capColor:n.outfit});rig.root.position.set(n.x,0,n.z);rig.root.rotation.y=n.heading;for(const m of rig.root.getChildMeshes())engine.registerShadowCaster(m);this.people.push({spec:n,rig,x:n.x,z:n.z});});
    const walkingRoads=world.roads.filter((r,i)=>r.type==='main'||i%4===0);
    const sidewalks:WalkerRoute[]=walkingRoads.flatMap(r=>{
      const vertical=Math.abs(r.x2-r.x1)<0.1,offset=r.width/2+1.15;
      return vertical
        ? [-1,1].map(side=>({x1:r.x1+side*offset,z1:r.z1,x2:r.x2+side*offset,z2:r.z2}))
        : [-1,1].map(side=>({x1:r.x1,z1:r.z1+side*offset,x2:r.x2,z2:r.z2+side*offset}));
    });
    const outfits=['#4d8dce','#d17b37','#48a978','#b45f72','#8b70bd','#c09a3d','#3b9a9d','#d2693e'];
    for(let i=0;i<14;i++){
      const route=sidewalks[i%sidewalks.length];
      const base=CHARACTERS[i%CHARACTERS.length];
      const spec:CharacterSpec={...base,id:`walker_${i}`,name:`Warga ${i+1}`,role:'Pejalan kaki',outfit:outfits[i%outfits.length],pants:i%2?'#37424e':'#34383d'};
      const rig=createCharacterRig(scene,spec);
      const phase=(i*0.217)%1,progress=phase;
      const x=route.x1+(route.x2-route.x1)*progress,z=route.z1+(route.z2-route.z1)*progress;
      rig.root.position.set(x,0,z);
      rig.root.rotation.y=Math.atan2(route.x2-route.x1,route.z2-route.z1);
      this.walkers.push({rig,route,phase,speed:1.0+(i%4)*0.16});
    }
  }
  nearest(x:number,z:number,radius:number):NPCRuntime|null {let best:NPCRuntime|null=null,d=radius;for(const n of this.people){const nd=Math.hypot(n.x-x,n.z-z);if(nd<d){d=nd;best=n;}}return best;}
  update(dt:number,t:number):void {
    for(const [i,n] of this.people.entries())n.rig.update(t+i*1.7,0);
    for(const [i,w] of this.walkers.entries()){
      const length=Math.hypot(w.route.x2-w.route.x1,w.route.z2-w.route.z1);
      w.phase=(w.phase+dt*w.speed/Math.max(1,length))%2;
      const forward=w.phase<=1,progress=forward?w.phase:2-w.phase;
      const sign=forward?1:-1;
      const x=w.route.x1+(w.route.x2-w.route.x1)*progress,z=w.route.z1+(w.route.z2-w.route.z1)*progress;
      w.rig.root.position.set(x,0,z);
      w.rig.root.rotation.y=Math.atan2((w.route.x2-w.route.x1)*sign,(w.route.z2-w.route.z1)*sign);
      w.rig.update(t+i*0.8,w.speed);
    }
  }
}

