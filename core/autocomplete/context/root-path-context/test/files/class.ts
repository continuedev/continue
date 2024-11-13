import {
  Address,
  Person,
  BaseClass,
  FirstInterface,
  SecondInterface,
  // @ts-ignore
} from "./types";

class Group extends BaseClass implements FirstInterface, SecondInterface {
  people: Person[];

  constructor(people: Person[]) {
    super();
    this.people = people;
  }

  getPersonAddress(person: Person): Address {
    return person.address;
  }

  getHardcodedAddress(): Address {
    return { street: "123 Main St", city: "Anytown" };
  }

  addPerson(person: Person) {
    this.people = [...this.people, person];
  }

  addPeople(people: Person[]) {
    this.people = [...this.people, ...people];
  }
}
