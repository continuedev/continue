export interface Person {
  firstName: string;
  lastName: string;
  age: number;
  address: Address;
}

export interface Address {
  street: string;
  city: string;
}
