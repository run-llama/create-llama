import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../collapsible";
import { EventData } from "./index";

export function ChatEvents({
  data,
  collapsed,
}: {
  data: EventData[];
  collapsed: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setIsOpen(!collapsed);
  }, [collapsed]);

  return (
    <div className="border-l-2 border-indigo-400 pl-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="secondary" className="space-x-2">
            <span>View progress</span>
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <div className="mt-4 text-sm space-y-2">
            {data.map((eventItem, index) => (
              <div key={index}>{eventItem.title}</div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
