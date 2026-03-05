import { createContext, useContext, useState } from 'react'

export type UserId = 'jeff' | 'john' | 'nick' | 'shane' | 'market'

interface UserContextValue {
  userId: UserId
  setUserId: (id: UserId) => void
  isMarket: boolean
}

const UserContext = createContext<UserContextValue>({
  userId: 'jeff',
  setUserId: () => {},
  isMarket: false,
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<UserId>('jeff')

  return (
    <UserContext.Provider value={{ userId, setUserId, isMarket: userId === 'market' }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}