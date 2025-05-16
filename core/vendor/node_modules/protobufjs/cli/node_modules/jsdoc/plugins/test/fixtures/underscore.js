'use strict';

/** This doclet will be shown by default, just like normal. */
function normal() {}

/** This doclet will be hidden by default because it begins with an underscore. */
function _hidden() {}

/**
 * Klass class
 * @class
 */
function Klass() {
    /** This is a private property of the class, and should not. */
    this._privateProp = null;

    /**
     * This is a property explicitly marked as private.
     * @private
     */
    this.privateProp = null;
}
