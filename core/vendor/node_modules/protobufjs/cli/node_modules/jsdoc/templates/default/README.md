The default template for JSDoc 3 uses: [the Taffy Database library](http://taffydb.com/) and the [Underscore Template library](http://underscorejs.org/).


## Generating Typeface Fonts

The default template uses the [OpenSans](https://www.google.com/fonts/specimen/Open+Sans) typeface. The font files can be regenerated as follows:

1. Open the [OpenSans page at Font Squirrel](<http://www.fontsquirrel.com/fonts/open-sans>).
2. Click on the 'Webfont Kit' tab.
3. Either leave the subset drop-down as 'Western Latin (Default)', or, if we decide we need more glyphs, than change it to 'No Subsetting'.
4. Click the 'DOWNLOAD @FONT-FACE KIT' button.
5. For each typeface variant we plan to use, copy the 'eot', 'svg' and 'woff' files into the 'templates/default/static/fonts' directory.
