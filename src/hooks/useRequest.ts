import { useCallback, useState } from 'react'

export type RequestApi<A extends any[], T> = (...args: A) => Promise<T>

const noop = () => {
  //
}

type RequestInternalState<D> = {
  response: D | undefined
  loading: boolean
  error: Error | undefined
  cancel: () => void
}

const initialState: RequestInternalState<any> = {
  response: undefined,
  loading: false,
  error: undefined,
  cancel: noop,
}

if (Object.freeze) Object.freeze(initialState)

/**
 * This hook used for network request status
 *
 * @param requestMethod network request method
 */
export function useRequest<A extends any[], D>(
  requestMethod: RequestApi<A, D> | undefined | null,
  that?: any,
): {
  response: D | undefined
  setResponse: React.Dispatch<React.SetStateAction<D | undefined>>
  loading: boolean
  error: Error | undefined
  cancel: () => void
  send: (...args: A) => () => void
} {
  const [state, setState] = useState<RequestInternalState<D>>(initialState)
  const setResponse = useCallback<React.Dispatch<React.SetStateAction<D | undefined>>>((value) => {
    setState((state) => {
      const prev = state.response
      let next: typeof prev
      if (typeof value === 'function') {
        next = (value as (prevState: D | undefined) => D | undefined)(prev)
      } else {
        next = value
      }
      return { ...state, response: next }
    })
  }, [])

  const doRequest = useCallback(
    (...args: A) => {
      let didCancel = false
      const cancelFn = () => {
        didCancel = true
      }

      setState((state) => ({
        ...state,
        loading: true,
        error: undefined,
        cancel: cancelFn,
      }))

      const requestPromise = requestMethod
        ? requestMethod.apply(that, args)
        : Promise.reject(new Error('No request method available.'))

      requestPromise
        .then((data) => {
          if (!didCancel) {
            setState((state) => ({
              ...state,
              loading: false,
              response: data,
            }))
          }
        })
        .catch((error) => {
          if (!didCancel) {
            setState((state) => ({
              ...state,
              loading: false,
              error: error,
            }))
          }
        })

      return cancelFn
    },
    [requestMethod, that],
  )

  return {
    response: state.response,
    setResponse: setResponse,
    loading: state.loading,
    error: state.error,
    cancel: state.cancel,
    send: doRequest,
  }
}
