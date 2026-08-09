<?php

namespace BaseNamespace;

use BaseNamespace\BaseClass;
use BaseNamespace\Interfaces\FirstInterface;
use BaseNamespace\Interfaces\SecondInterface;
use BaseNamespace\Person;
use BaseNamespace\Address;

function getAddress(Person $person): Address
{
    return $person->getAddress();
}

class Group extends BaseClass implements FirstInterface, SecondInterface
{
    private array $people;

    public function __construct(array $people)
    {
        parent::__construct();
        $this->people = $people;
    }

    public function getPersonAddress(Person $person): Address
    {
        return getAddress($person);
    }
}

?>