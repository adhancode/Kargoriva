import type { PackageRuntime } from './DeliveryManager';
import type { VehicleSpec } from '../data/types';
import { PACKAGE_DIMS, type WorldData } from '../data/types';

export interface SortingReport { packed: PackageRuntime[]; totalWeight: number; totalVolume: number; weightCapacity: number; volumeCapacity: number; countOk: boolean; weightOk: boolean; volumeOk: boolean; zoneCount: number; }
export function computeSorting(packages: PackageRuntime[], vehicle: VehicleSpec, _dc: WorldData['dc'], customers: Map<string, {x:number;z:number}>): SortingReport {
  const packed = [...packages].sort((a,b) => Number(!!a.fragile) - Number(!!b.fragile) || b.weight - a.weight);
  const totalWeight = packed.reduce((s,p)=>s+p.weight,0); const totalVolume = packed.reduce((s,p)=>{ const d=PACKAGE_DIMS[p.size]; return s+d.l*d.w*d.h/1000000; },0);
  return { packed, totalWeight, totalVolume, weightCapacity: vehicle.cargoWeight, volumeCapacity: vehicle.cargoVolume, countOk: packages.length<=vehicle.capacity, weightOk: totalWeight<=vehicle.cargoWeight, volumeOk: totalVolume<=vehicle.cargoVolume, zoneCount: new Set([...customers.values()].map(p=>Math.round(p.x/80)+','+Math.round(p.z/80))).size };
}
export interface RouteLeg { target: string; distanceM: number; }
export function computeRoute(legs: RouteLeg[], customers: {payment:number}[], fuelCapacity: number, fuelUse: number, speedKmh: number) {
  const totalDistanceKm = legs.reduce((s,l)=>s+l.distanceM,0)/1000; const fuelEstimateL = Math.min(fuelCapacity, totalDistanceKm * Math.max(0.07, fuelUse * 1.7)); const timeEstimateMin = totalDistanceKm / Math.max(10,speedKmh) * 60; const potentialRevenue = customers.reduce((s,c)=>s+c.payment,0);
  return { legs, totalDistanceKm, fuelEstimateL, timeEstimateMin, potentialRevenue };
}
export function computeEvaluationMath(input: {delivered:number;total:number;onTime:boolean;damage:number;fuelLeftPct:number;fuelCapacity:number;level:number;baseSalaryPerLevel:number;receivedPayments:number;deposited:number;discrepancy:number;bonuses:{amount:number}[];penalties:{amount:number}[]}) {
  const deliveryRate = input.total ? input.delivered/input.total*100 : 0; const baseSalary = input.baseSalaryPerLevel*Math.max(1,input.level); const fuelUsedL = input.fuelCapacity*(1-Math.max(0,Math.min(100,input.fuelLeftPct))/100); const fuelCost = fuelUsedL*10000; const netPay = Math.max(0,baseSalary+input.bonuses.reduce((s,b)=>s+b.amount,0)-input.penalties.reduce((s,p)=>s+p.amount,0));
  return { deliveryRate, baseSalary, fuelUsedL, fuelCost, netPay, receivedPayments:input.receivedPayments, deposited:input.deposited, discrepancy:input.discrepancy, onTime:input.onTime, damage:input.damage };
}

