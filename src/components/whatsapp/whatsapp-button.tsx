import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export function WhatsAppButton({
  mobile,
  message,
  label = "Send via WhatsApp",
  variant = "outline",
  className,
}: {
  mobile: string;
  message: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
}) {
  const href = buildWhatsAppLink(mobile, message);

  return (
    <Button
      variant={variant}
      className={cn("text-emerald-700 dark:text-emerald-400", className)}
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      <MessageCircle className="h-4 w-4" />
      {label}
    </Button>
  );
}
