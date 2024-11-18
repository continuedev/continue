// @ts-nocheck

class Group extends BaseClass {}

class Group implements FirstInterface {}

class Group extends BaseClass implements FirstInterface, SecondInterface {}

class Group extends BaseClass<User> implements FirstInterface<User> {}
