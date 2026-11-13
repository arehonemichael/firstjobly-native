/** Only existing in-app routes may be used as authentication return destinations. */
export function authDestination(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || /[\\\s]/.test(candidate) || /%2f|%5c/i.test(candidate))
    return "/";
  const pathname = candidate.split(/[?#]/)[0];
  return /^\/(?:\(tabs\)\/)?(?:jobs(?:\/[a-zA-Z0-9_-]+)?|saved|applications|tools|preferences|discover|profile|cv-maker|z83|hot-jobs|(?:community|graduateroom)(?:\/[a-zA-Z0-9_-]+)?)?\/?$/.test(
    pathname,
  )
    ? candidate
    : "/";
}
