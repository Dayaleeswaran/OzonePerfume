-- Contact and newsletter forms now go through the public-forms Edge Function, which verifies the
-- Cloudflare Turnstile CAPTCHA before calling these functions (SEC-015). Close the direct browser path
-- so bots can't skip the CAPTCHA by calling the RPCs themselves.
revoke execute on function public.send_message(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.subscribe_newsletter(text) from public, anon, authenticated;
grant execute on function public.send_message(text, text, text, text, text) to service_role;
grant execute on function public.subscribe_newsletter(text) to service_role;
