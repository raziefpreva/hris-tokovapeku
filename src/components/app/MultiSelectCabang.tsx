import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandEmpty } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CabangOption {
  id_cabang: string;
  nama_cabang: string;
}

export function MultiSelectCabang({
  options,
  value,
  onChange,
  placeholder = "Pilih cabang...",
}: {
  options: CabangOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const allSelected = options.length > 0 && value.length === options.length;

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  function toggleAll() {
    onChange(allSelected ? [] : options.map((o) => o.id_cabang));
  }

  const label =
    value.length === 0
      ? placeholder
      : allSelected
        ? "Semua Cabang Selected"
        : options
            .filter((o) => value.includes(o.id_cabang))
            .map((o) => o.nama_cabang)
            .join(", ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate text-left", value.length === 0 && "text-muted-foreground")}>
            {label}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari cabang..." />
          <CommandList>
            <CommandEmpty>Tidak ada cabang.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={toggleAll} className="gap-2">
                <Checkbox checked={allSelected} className="pointer-events-none" />
                <span className="font-semibold">Select All</span>
                {allSelected && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((o) => {
                const checked = value.includes(o.id_cabang);
                return (
                  <CommandItem
                    key={o.id_cabang}
                    onSelect={() => toggle(o.id_cabang)}
                    className="gap-2"
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    {o.nama_cabang}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}