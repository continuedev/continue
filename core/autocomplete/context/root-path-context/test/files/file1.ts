import {
  Address,
  Person,
  BaseClass,
  FirstInterface,
  SecondInterface,
  // @ts-ignore
} from "./types";

function getAddress(person: Person): Address {
  return person.address;
}

class Group extends BaseClass implements FirstInterface, SecondInterface {
  people: Person[];

  constructor(people: Person[]) {
    super();
    this.people = people;
  }

  getPersonAddress(person: Person): Address {
    return getAddress(person);
  }
}
