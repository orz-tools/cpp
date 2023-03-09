import React, { useContext } from "react";
import { Constructor, Container } from "./pkg/container";

export const ContainerContext = React.createContext<Container>(new Container())

export function useContainer() {
  return useContext(ContainerContext)
}

export function useInject<T extends object>(constructor: Constructor<T>): T {
  return useContainer().get(constructor)
}