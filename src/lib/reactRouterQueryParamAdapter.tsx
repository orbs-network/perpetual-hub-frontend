import { useMemo } from "react";
import {
  useLocation,
  useNavigate,
  type To,
} from "react-router-dom";
import type {
  PartialLocation,
  QueryParamAdapterComponent,
} from "use-query-params";

export const ReactRouterQueryParamAdapter: QueryParamAdapterComponent = ({
  children,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const adapter = useMemo(
    () => ({
      location: {
        search: location.search,
        state: location.state,
      },
      push(nextLocation: PartialLocation) {
        navigate(toSearchLocation(nextLocation, location.hash), {
          replace: false,
          state: nextLocation.state,
        });
      },
      replace(nextLocation: PartialLocation) {
        navigate(toSearchLocation(nextLocation, location.hash), {
          replace: true,
          state: nextLocation.state,
        });
      },
    }),
    [location.hash, location.search, location.state, navigate],
  );

  return children(adapter);
};

function toSearchLocation(location: PartialLocation, hash: string): To {
  return {
    search: location.search || "",
    hash,
  };
}
