// Shared sign-in for the e2e scripts: every app route sits behind /login.
export async function signIn(page, base, name = 'Hannah Lee', workspace) {
  await page.goto(base + '/login')
  await page.getByRole('button', { name: 'Sign in with SSO', exact: true }).click()
  if (workspace) await page.getByRole('combobox').selectOption(/acme/i.test(workspace) ? 'acme' : 'northstar')
  await page.getByRole('button', { name: new RegExp(name) }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}
