// Admins may delete (patients, catalog medicines, drugs from a meal, slot
// assignments) and manage roles; dispensing nurses can't. The server enforces
// this - the app only hides what the account isn't allowed to do.
export function isAdmin(nurse) {
  return nurse?.role === 'admin'
}
