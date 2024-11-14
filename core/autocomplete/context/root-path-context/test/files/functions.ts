import {
  Address,
  Person,
  // @ts-ignore
} from "./types";

function getAddress(person: Person): Address {
  return person.address;
}

function getFirstAddress(people: Person[]): Address {
  return people[0].address;
}

function logPerson(person: Person) {
  console.log(`Name: ${person.name}, Age: ${person.age}`);
}

function getHardcodedAddress(): Address {
  return { street: "123 Main St", city: "Anytown", zipCode: "12345" };
}

function getAddresses(people: Person[]): Address[] {
  return people[0].address;
}

function logPersonWithAddress(person: Person<Address>): Person<Address> {
  console.log(
    `Name: ${person.name}, Age: ${person.age}, Address: ${person.address.street}`,
  );
  return person;
}
