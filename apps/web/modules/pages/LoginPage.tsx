import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { loginSchema, type LoginFormData } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Redirect, useLocation, Link } from "wouter";
import { Loader2 } from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { useState } from "react";
import { useTranslation } from 'react-i18next';

function sanitizeRedirectPath(raw: string | null): string {
  if (!raw) return "/intelligent-gateway";
  if (!raw.startsWith("/")) return "/intelligent-gateway";
  if (raw.startsWith("//")) return "/intelligent-gateway";
  if (raw.includes("\\")) return "/intelligent-gateway";
  return raw;
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  // Extract redirect parameter from query string
  const searchParams = new URLSearchParams(window.location.search);
  const redirect = sanitizeRedirectPath(searchParams.get('redirect'));

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await login(data.identifier, data.password);
      toast({
        title: t('app.success'),
        description: t('auth.loginSuccess', 'Logged in successfully'),
      });
      setLocation(redirect);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('auth.loginFailed');
      toast({
        title: t('auth.login'),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Redirect to={redirect} />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Main Login Card */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-8 flex flex-col items-center">
              <HexagonLogoFrame size="xl" animated />
              <span className="mt-5 text-[28px] font-extrabold tracking-[0.08em] bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent uppercase select-none">
                COREVIA
              </span>
              <span className="mt-1.5 text-xs font-medium tracking-[0.14em] text-muted-foreground/80 uppercase select-none">
                {t('app.tagline')}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.usernameOrEmail', 'Username or Email')}</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder="admin@corevia.local or superadmin"
                          data-testid="input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.password')}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t('auth.enterPassword')}
                          data-testid="input-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('app.loading')}
                    </>
                  ) : (
                    t('auth.loginButton')
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {t('auth.dontHaveAccount')}{" "}
              <Link href="/register" data-testid="link-register">
                <span className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-medium">
                  {t('auth.register')}
                </span>
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
