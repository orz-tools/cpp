import { MenuDivider, MenuItem } from '@blueprintjs/core'
import { memo, useMemo } from 'react'
import { useCpp } from '../Cpp'
import { formatProfileName, getProfiles } from '../profiles'

export const ProfileTitle = memo(({ codename, profile }: { codename: string; profile: string }) => {
  return (
    <code title={formatProfileName(codename, profile)}>
      [{codename.toUpperCase()}]["
      <span
        style={{
          maxWidth: '16ch',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'inline-block',
          verticalAlign: 'bottom',
        }}
      >
        {JSON.stringify(decodeURIComponent(profile)).slice(1, -1)}
      </span>
      "]
    </code>
  )
})

export const ProfileMenu = memo(() => {
  const profiles = useMemo(() => getProfiles().filter((x) => !x[2]), [])
  const cpp = useCpp()
  return (
    <>
      {profiles.map((profile) => (
        <MenuItem
          key={profile[0] + '/' + profile[1]}
          href={`/${profile[0]}/${profile[1]}`}
          text={<ProfileTitle codename={profile[0]} profile={profile[1]} />}
          active={profile[0].toString() === cpp.gameAdapter.getCodename() && profile[1] === cpp.instanceName}
        />
      ))}
      <MenuDivider />
      <MenuItem text="Home" icon="home" href="/" />
    </>
  )
})
