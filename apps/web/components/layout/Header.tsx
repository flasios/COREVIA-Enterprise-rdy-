import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { UserMenu, NotificationCenter } from "@/components/shared/user";
import { useAuth } from "@/contexts/AuthContext";
import { Can } from "@/components/auth/Can";
import { Users } from "lucide-react";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from 'react-i18next';
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";

function AnimatedLogo() {
  return (
    <div className="flex items-center gap-3">
      <HexagonLogoFrame size="sm" />
      <div className="flex flex-col leading-none">
        <span className="text-[17px] font-extrabold tracking-wide bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent select-none uppercase">
          COREVIA
        </span>
        <span className="text-[9px] font-medium tracking-[0.12em] text-muted-foreground/70 select-none mt-0.5">
          Portfolio Intelligence
        </span>
      </div>
    </div>
  );
}

export default function Header() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

  return (
    <header className="px-6 py-4 bg-background border-b">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/">
            <div className="cursor-pointer">
              <AnimatedLogo />
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {!isLoading && (
            <>
              {isAuthenticated ? (
                <>
                  <CommandPalette />
                  <Can permissions={["user:read"]}>
                    <Link href="/admin/users">
                      <Button variant="ghost" data-testid="button-user-management">
                        <Users className="mr-2 h-4 w-4" />
                        {t('nav.users')}
                      </Button>
                    </Link>
                  </Can>
                  <LanguageSwitcher />
                  <NotificationCenter />
                  <UserMenu />
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" data-testid="button-login-header">
                      {t('auth.login')}
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button data-testid="button-register-header">
                      {t('auth.register', 'Register')}
                    </Button>
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
