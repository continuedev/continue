import { Address, Person } from "./types";

function getAddress(person: Person): Address {
  return person.address;
}

class Group {
  people: Person[];

  constructor(people: Person[]) {
    this.people = people;
  }

  getPersonAddress(person: Person): Address {
    return getAddress(person);
  }
}
