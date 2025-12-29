import React from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { getBusinessDaysDiff } from "../../utils/formatters"; 

export default function DaysBadge({ date }) {
  const days = getBusinessDaysDiff(date);
  
  let colorClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
  let Icon = Clock;
  
  if (days >= 5 && days < 8) {
    colorClass = "bg-yellow-100 text-yellow-700 border-yellow-200";
    Icon = AlertTriangle;
  } else if (days >= 8 && days <= 9) {
    colorClass = "bg-red-100 text-red-700 border-red-200 animate-pulse";
    Icon = AlertTriangle;
  } else if (days > 9) {
    colorClass = "bg-purple-900 text-white border-purple-950";
    Icon = AlertTriangle;
  }

  return (
    <div
      className={`flex flex-col items-center justify-center border rounded-lg px-2 py-1 min-w-[50px] ${colorClass}`}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase font-bold">
        <Icon size={10} />
        <span>{days > 9 ? "+9" : days} Dias</span>
      </div>
      <span className="text-[9px] opacity-80 font-mono">ÚTEIS</span>
    </div>
  );
}