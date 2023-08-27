import { useAtomValue } from 'jotai'
import { memo, useEffect, useState } from 'react'
import { useCpp } from '../Cpp'
import { BlobFlavour, BlobImages, badUrl, load } from '../pkg/blobcache'

export const CachedImg = memo(
  ({
    src,
    flavour,
    width,
    height,
    alt,
    title,
    style,
    className,
  }: {
    src: BlobImages
    flavour?: BlobFlavour
    width?: JSX.IntrinsicElements['img']['width']
    height?: JSX.IntrinsicElements['img']['height']
    alt?: JSX.IntrinsicElements['img']['alt']
    title?: JSX.IntrinsicElements['img']['title']
    style?: JSX.IntrinsicElements['img']['style']
    className?: JSX.IntrinsicElements['img']['className']
  }) => {
    const cpp = useCpp()
    const blobFlavour = useAtomValue(cpp.preferenceAtoms.blobFlavourAtom)

    const data = load(src, flavour || blobFlavour)
    const [, render] = useState(0)

    useEffect(() => {
      if (typeof data === 'string') return
      let run = true
      void data.then(() => run && render((x) => x + 1)).catch(() => run && render((x) => x + 1))
      return () => {
        run = false
      }
    }, [data])

    if (!(typeof data === 'string')) {
      return <img width={width} height={height} alt={''} title={title} style={style} className={className} />
    }

    const bad = data === badUrl
    return (
      <img
        src={data}
        width={width}
        height={height}
        alt={alt}
        title={title}
        style={{
          ...style,
          overflow: 'hidden',
          overflowWrap: 'break-word',
          ...(bad
            ? {
                opacity: 0.25,
                color: 'red',
                border: '1px solid red',
              }
            : {}),
        }}
        className={(className || '') + ' ' + (bad ? 'cpp-bad-img' : '')}
      />
    )
  },
)

export const EmptyIcon = memo(() => {
  return <span className="bp5-menu-item-icon"></span>
})
