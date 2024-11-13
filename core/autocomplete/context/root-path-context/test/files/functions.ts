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
