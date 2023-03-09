import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppWrapper } from './App'
import { ContainerContext } from './hooks'
import './index.css'
import { Container } from './pkg/container'
import { DataManager } from './pkg/cpp-core/DataManager'

const container = new Container()
void container.get(DataManager).init()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ContainerContext.Provider value={container}>
      <AppWrapper />
    </ContainerContext.Provider>
  </React.StrictMode>,
)
