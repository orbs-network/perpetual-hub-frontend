import { useCallback, useMemo } from "react";
import { useAppQueryParams } from "./useAppQueryParams";
import { useNavigate } from "react-router-dom";

export const usePath = (path: string) => {
  const { queryString } = useAppQueryParams();

  return useMemo(() => {
    return `${path}${queryString}`;
  }, [path, queryString]);
};


export const useNavigateWithQuery = () => {
  const { queryString } = useAppQueryParams();
  const navigate = useNavigate();
  return useCallback((path: string) => {
    navigate(`${path}${queryString}`);
  }, [queryString, navigate]);
};