"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, LogIn, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/safe-redirect";

const inputClass = "h-15 rounded-2xl bg-muted/50 pl-11 text-base focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-ring/15 md:text-base";

export function SigninForm() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const username = String(data.get("username") ?? "").trim();
        const password = String(data.get("password") ?? "");
        if (!username || !password) {
          setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
          return;
        }
        setError(null);
        setPending(true);
        const { error } = await authClient.signIn.username({ username, password });
        if (error) {
          setPending(false);
          setError(
            error.status === 429
              ? "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่"
              : error.status === 403
                ? "บัญชีนี้ถูกระงับการใช้งาน"
                : "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
          );
          return;
        }
        router.replace(safeNextPath(new URLSearchParams(window.location.search).get("next")));
        router.refresh();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="username" className="font-semibold">
          ชื่อผู้ใช้ (Username)
        </Label>
        <div className="relative">
          <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="username" name="username" autoComplete="username" autoFocus placeholder="กรอกชื่อผู้ใช้" className={`${inputClass} pr-4`} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="font-semibold">
          รหัสผ่าน
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="กรอกรหัสผ่าน"
            className={`${inputClass} pr-12`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            className="absolute right-2 top-1/2 size-10 -translate-y-1/2 rounded-xl text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="animate-drop rounded-xl bg-red-50 px-4 py-3 text-sm text-destructive dark:bg-red-500/15">
          {error}
        </p>
      )}
      <Button type="submit" variant="gradient" disabled={pending} className="mt-6 h-16 w-full gap-2 rounded-2xl text-lg sm:h-18 [&_svg:not([class*='size-'])]:size-5">
        {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
        {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </Button>
    </form>
  );
}
