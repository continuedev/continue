package main

import (
	"core/autocomplete/context/root-path-context/test/files/models"
)

func getAddress(user *models.User) *models.Address {
	return user.Address
}