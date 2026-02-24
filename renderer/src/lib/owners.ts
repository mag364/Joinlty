export const ownerDisplayName = (ownerType: 'member' | 'joint', ownerId: string, members: Array<{ id: string; name: string }>) => {
  if (ownerType === 'joint') return 'Household Joint'
  return members.find((member) => member.id === ownerId)?.name ?? ownerId
}
