import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type AuthState = {
  token: string | null;
  team: any | null;
};

type AuthContextType = AuthState & {
  login: (token: string, team: any) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem("overthrone_token");
    const teamStr = localStorage.getItem("overthrone_team");
    let team = null;
    if (teamStr) {
      try {
        team = JSON.parse(teamStr);
      } catch (e) { }
    }
    return { token, team };
  });

  const login = (token: string, team: any) => {
    localStorage.setItem("overthrone_token", token);
    localStorage.setItem("overthrone_team", JSON.stringify(team));
    setState({ token, team });
  };

  const logout = () => {
    localStorage.removeItem("overthrone_token");
    localStorage.removeItem("overthrone_team");
    setState({ token: null, team: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
