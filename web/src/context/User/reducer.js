/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// Centralised user storage so component code doesn't have to keep
// `localStorage.setItem('user', JSON.stringify(...))` and the in-memory
// state in sync.
const persistUser = (user) => {
  try {
    if (user === null || user === undefined) {
      localStorage.removeItem('user');
    } else {
      localStorage.setItem('user', JSON.stringify(user));
    }
  } catch {}
};

export const reducer = (state, action) => {
  switch (action.type) {
    case 'login':
      persistUser(action.payload);
      return {
        ...state,
        user: action.payload,
      };
    case 'logout':
      persistUser(null);
      return {
        ...state,
        user: undefined,
      };

    default:
      return state;
  }
};

export const initialState = {
  user: undefined,
};
