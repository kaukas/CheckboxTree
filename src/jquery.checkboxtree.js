/*
 *
 * CheckboxTree
 *
 * It is a DOM tree of checkboxes which can be (un)selected.
 *
 * Example of usage:
 *  
 *  tree = $('#tree-container').checkboxtree({
 *      // Initially selected values. If the value is not at the root level then
 *      // its parents have to be specified
 *      selected: [ {value: '0'}, {value: '110', parents: ['1', '11']} ],
 *      // Provide children for the given item. The children are provided for
 *      // the callback function, not returned
 *      childrenProvider: function (item, callback) {
 *          callback([{
 *              value: '0',
 *              title: 'Zero'
 *          }, {
 *              value: '1',
 *              title: 'Two',
 *              children: [ <similar structure here repeated recursively> ]
 *          }]
 *      },
 *      // Provide children for multiple items at once
 *      multiChildrenProvider: function (items, callback) {
 *          callback([...]);
 *      },
 *      // A callback called when a item is (un)selected.
 *      onSelect: function (item, newState) {
 *      }
 *  });
 *
 * Besides the options these are the methods that can and should be called on
 * the tree object:
 *
 *  display()
 *  Draw the checkbox tree.
 *
 *  destroy()
 *  Remove the checkbox tree from the DOM
 *
 *  hide()
 *  Cleanup. Currently just resets the quick search input
 *
 *  getSelected()
 *  Return the selected items with their parents
 *
 *  A item is an object in the form:
 *
 *  {
 *      value: 'some-value',
 *      title: 'Some Title',
 *      children: [...]     // A list of items. If to-be-loaded then '?'
 *  }
 *
 *  If an item has children they can be provided in a list directly or could be
 *  replaced with a '?'. In the latter case the childrenProvider or
 *  multiChildrenProvider callback will be used to get the children list on
 *  demand.
 *
 *  getSelected returns nodes in the form:
 *
 *  {
 *      value: 'some-value',
 *      parents: ['parent-level-0', 'parent-level-1', ...]
 *  }
 *
 *  The same nodes can be supplied to the `selected` option.
 *
 */

/*globals jQuery, window */

"use strict";

(function ($) {
    function CheckboxTree(target, options) {
        this.target = $(target);
        this.options = options;
        this.init();
    }
    
    $.fn.checkboxtree = function (options) {
        options = $.extend({}, $.fn.checkboxtree.defaults, options);
        return new CheckboxTree(this[0], options);
    };

    // These are the default (empty) options though not very useful by
    // themselves
    $.fn.checkboxtree.defaults = {
        selected: [],
        onSelect: function (item, newState) {
        },
        childrenProvider: function (item, callback) {
            callback([]);
        },
        multiChildrenProvider: function (items, callback) {
            callback([]);
        }
    };

    // Helper functions

    // Return True if the array or object is empty
    function isEmpty(o) {
        var i;
        if (!o) {
            return true;
        }
        if (typeof o === 'object') {
            if (o) {
                if (typeof o.length === 'number' &&
                        !o.propertyIsEnumerable('length') &&
                        typeof o.splice === 'function') {
                    // We have an  array
                    return o.length === 0;
                } else {
                    for (i in o) {
                        if (o.hasOwnProperty(i)) {
                            return false;
                        }
                    }
                    return true;
                }
            } else {
                return true;
            }
        }
    }


    CheckboxTree.prototype = {
        init: function () {
            this.items = [];
            this.itemTree = {};

            var that = this;
            this.options.childrenProvider.call(this, undefined,
                function (items) {
                that.toItems(null, $.extend(true, [], items));
                that.loadSelectedValues();
            });
        },

        list: function () {
            // Will return UL if it exists
            return this.target.children('ul');
        },

        // Convert a recursive list of nodes into a lookup (dict) for fast
        // search and access
        toItems: function (parent, items) {
            var treeItem, i, item;
            if (parent) {
                treeItem = this.itemTree[parent];
                if (treeItem.children === '?' || isEmpty(treeItem.children)) {
                    treeItem.item.children = items;
                    treeItem.children = {};
                }
            } else {
                this.items = items;
            }
            for (i = 0; i < items.length; i += 1) {
                item = items[i];
                treeItem = {
                    item: item
                };
                if (parent) {
                    treeItem.parent = parent;
                    if (!this.itemTree[parent].children.hasOwnProperty(
                            item.value)) {
                        this.itemTree[parent].children[item.value] = i;
                    }
                }
                this.itemTree[item.value] = treeItem;

                if (item.children === '?') {
                    treeItem.children = '?';
                } else if (typeof item.children === 'object') {
                    this.toItems(item.value, item.children);
                }
            }
        },

        // Return a tree item if exists
        treeItem: function (value) {
            if (this.itemTree.hasOwnProperty(value)) {
                return this.itemTree[value];
            }
            return {};
        },

        // Return a list of parent values for the given value
        getParents: function (value) {
            var parents = [],
                parent = this.itemTree[value].parent;
            while (parent) {
                parents.unshift(parent);
                parent = this.itemTree[parent].parent;
            }
            return parents;
        },

        // Given a DOM node return the corresponding item from the source item
        // list
        getItemFromDom: function (node) {
            var li = $(node).closest('li'),
                indices = [], item = null, items = this.items, i;
            while (li.length) {
                indices.unshift(li.prevAll().length);
                li = li.parent().parent('li');
            }
            for (i = 0; i < indices.length; i += 1) {
                item = items[indices[i]];
                items = item.children;
            }
            return item;
        },

        // Load the bare minimum of values which are needed to select the
        // provided values.
        loadSelectedValues: function () {
            if (isEmpty(this.options.selected)) {
                // Nothing to select, nothing to load
                this.options.onSelect.call(this);
                return;
            }
            var that = this, toOpen = [], parents,
                s, p, v, prevValue, value;
            for (s = 0; s < this.options.selected.length; s += 1) {
                parents = this.options.selected[s].parents || [];
                p = 0;
                while (p < parents.length &&
                    typeof this.treeItem(parents[p]).children === 'object') {
                    p += 1;
                }

                if (p < parents.length) {
                    while (toOpen.length < parents.length) {
                        toOpen.push([]);
                    }
                    for (; p < parents.length; p += 1) {
                        toOpen[p].push(parents[p]);
                    }
                }
            }
            for (p = 0; p < toOpen.length; p += 1) {
                if (toOpen[p].length > 1) {
                    toOpen[p].sort();
                    prevValue = undefined;
                    for (v = 0; v < toOpen[p].length; v += 1) {
                        value = toOpen[p][v];
                        if (value === prevValue) {
                            toOpen[p].splice(v, v);
                        } else {
                            prevValue = value;
                        }
                    }
                }
            }
            while (toOpen.length > 0 && isEmpty(toOpen[toOpen.length - 1])) {
                toOpen.pop();
            }

            if (toOpen.length === 0) {
                this.options.onSelect.call(this);
            } else {
                this.waitingForValues = true;
                this.options.multiChildrenProvider.call(this, toOpen,
                        function (newItems) {
                    var i, newItem;
                    for (i = 0; i < newItems.length; i += 1) {
                        newItem = newItems[i];
                        that.toItems(newItem.value, newItem.subtree);
                    }

                    that.waitingForValues = false;
                    if (that.displayOnMultiItems) {
                        that.displayOnMultiItems = false;
                        that.display();
                    }
                    that.options.onSelect.call(that);
                });
            }
        },

        // Create a checkbox check handler. A single handler is bound to the
        // container and listens to all events.
        makeClickHandler: function () {
            var that = this;

            // Handle the checkbox click
            function handleCheckbox(e) {
                $(this).parent().next('ul').find('input').
                    attr('checked', this.checked);

                function checkAllChecked(li) {
                    if (!li.is('li')) {
                        return false;
                    }
                    if (!li.parent().parent().is('li')) {
                        return false;
                    }

                    var nodes = li.siblings().children('label').children(), n;
                    for (n = 0; n < nodes.length; n += 1) {
                        if (!nodes[n].checked) {
                            return false;
                        }
                    }
                    return true;
                }
                var li, item;
                if (this.checked) {
                    li = $(this).parent().parent();
                    while (checkAllChecked(li)) {
                        li = li.parent().parent();
                        li.children('label').children().attr('checked', true);
                    }
                } else {
                    $(this).parents('li:gt(0)').children('label').children().
                            removeAttr('checked');
                }
                item = that.getItemFromDom(this);
                that.options.onSelect.call(that, item, this.checked);
            }

            // Handle the LI element click
            function handleList(e) {
                var $this = $(this), list, item, param;
                function checkDescendants(list) {
                    if ($this.children('label').children().is(':checked')) {
                        list.find('input').attr('checked', 'checked');
                    }
                }
                if ($this.hasClass('closed')) {
                    $this.removeClass('closed');
                    list = $this.children('ul');
                    if (list.length) {
                        checkDescendants(list);
                    } else {
                        list = $('<ul>Loading...</ul>').appendTo($this);
                        item = that.getItemFromDom($this);
                        param = $.extend(true, {
                            parents: that.getParents(item.value)
                        }, item);
                        that.options.childrenProvider.call(that, param,
                                function (items) {
                            that.toItems(item.value, $.extend(true, [], items));
                            var listHtml = [], n;
                            for (n = 0; n < items.length; n += 1) {
                                listHtml.push(that.itemHtml(items[n]));
                            }
                            list.empty().html(listHtml.join(''));
                            checkDescendants(list);
                        });
                    }
                } else {
                    $this.addClass('closed');
                }
            }

            this.clickHandler = function (e) {
                var target = $(e.target);
                if (target.closest('input').length) {
                    // The checkbox was clicked
                    handleCheckbox.call(e.target, e);
                } else if (target.closest('label').length) {
                    // skip - if a label is clicked, the input will get another
                    // event
                } else if (target.closest('li').length) {
                    // The list element was clicked
                    handleList.call(e.target, e);
                }
            };
        },

        // Construct the item HTML taking into account which nodes have to be
        // checked (given by toSelect)
        itemHtml: function (item, toSelect) {
            var li = '<li',
                input = '<input type="checkbox"',
                label, title, classes, children, c;
                
            toSelect = toSelect || {};

            if (toSelect.hasOwnProperty(item.value)) {
                input += 'checked="checked" />';
            } else {
                input += ' />';
            }

            label = '<label>' + input;
            title = item.title || item.value;
            if (item.desc) {
                title += ' - ' + item.desc;
            }
            label += title + '</label>';

            classes = [];
            children = '';
            if (item.children) {
                classes.push('has_children');
                if (typeof item.children === 'object') {
                    children = ['<ul>'];
                    for (c = 0; c < item.children.length; c += 1) {
                        children.push(this.itemHtml(item.children[c],
                            toSelect));
                    }
                    children.push('</ul>');
                    children = children.join('');
                    if (children.indexOf('checked="checked"') === -1) {
                        classes.push('closed');
                    }
                } else {
                    classes.push('closed');
                }
            }
            if (!isEmpty(classes)) {
                li += ' class="' + classes.join(' ') + '">';
            } else {
                li += '>';
            }
            li += label;
            if (children !== '') {
                li += children;
            }
            li += '</li>';
            return li;
        },

        // Draw the checkbox tree. If the values have not been loaded wait for
        // them to be loaded.
        display: function () {
            if (this.waitingForValues) {
                this.displayOnMultiItems = true;
                this.target.html('<span>Loading...</span>');
                return;
            }

            var select = {}, selectList, s, n,
                list = [], length = 0, item,
                searchTimeout = null, lastSearch = '',
                that = this;
            if (!isEmpty(this.options.selected)) {
                selectList = this.options.selected;
                for (s = 0; s < selectList.length; s += 1) {
                    select[selectList[s].value] = null;
                }
            }

            // Check the itemTree how many nodes we have. If we have more than 3
            // (on all levels) then we'll show 'Select/Unselect all'
            for (item in this.itemTree) {
                if (this.itemTree.hasOwnProperty(item)) {
                    length += 1;
                    if (length > 20) {
                        break;
                    }
                }
            }
            // Select All, Unselect All links
            if (length > 3) {
                list.push('<a href="#" class="select_all_items">' +
                    'Select All</a> | ');
                list.push('<a href="#" class="unselect_all_items">' +
                    'Unselect All</a> ');
            }
            // Quick search input
            if (length >= 3) {
                list.push('<input type="text" class="quick_search"></input>');
            }

            list.push('<ul class="checkbox_tree">');
            for (n = 0; n < this.items.length; n += 1) {
                list.push(this.itemHtml(this.items[n], select));
            }
            list.push('</ul>');
            list = list.join('');
            this.target.html(list);

            // Create the click handler
            this.makeClickHandler();
            // Bind the click handler
            this.target.click(this.clickHandler);
            this.target.children('a.select_all_items').click(function () {
                that.selectAll();
                return false;
            });
            this.target.children('a.unselect_all_items').click(function () {
                that.unselectAll();
                return false;
            });
            // Implement the quick search functionality. The filtering happens
            // in chunks because filtering all items at once takes a lot of time
            // with numbers around 1K+. We want to prevent the UI freeze.
            this.target.children('input.quick_search').keyup(function (e) {
                var value = $(this).val().toLowerCase(),
                    lis, textAttr,
                    chunkSize = 100;
                
                if (searchTimeout) {
                    window.clearTimeout(searchTimeout);
                }
                function filterChunk(lis, startFrom) {
                    var i, li,
                        max = Math.min(lis.length, startFrom + chunkSize);
                    for (i = startFrom; i < max; i += 1) {
                        li = lis[i];
                        $(li).toggle(
                                li[textAttr].toLowerCase().indexOf(value) > -1);
                    }
                    if (max < lis.length) {
                        searchTimeout = window.setTimeout(function () {
                            filterChunk(lis, max);
                        }, 80);
                    }
                }
                if (value) {
                    if (value.indexOf(lastSearch) > -1) {
                        lis = that.list().children('li:visible');
                    } else {
                        lis = that.list().children('li');
                    }
                    if (lis.length > 0) {
                        textAttr = lis[0].innerText === undefined ?
                                'textContent' : 'innerText';
                        filterChunk(lis, 0);
                    }
                } else {
                    that.list().children('li').show();
                }
                lastSearch = value;
            }).focus(function () {
                var $this = $(this);
                if ($this.hasClass('empty')) {
                    $this.removeClass('empty').val('');
                }
            }).blur(function () {
                var $this = $(this);
                if ($this.val() === '') {
                    $this.addClass('empty').val('Quick search');
                }
            }).blur();
        },

        // Remove the Checkbox tree and unbind the click handlers
        destroy: function () {
            this.target.empty().unbind('click');
        },

        // Return a list of selected values
        getSelected: function (root, items, parents) {
            var selected = [], item, nodes, inputs, n, node, s,
                childrenList, selectedList;
            root = root || this.list();
            items = items || this.items;
            if (root.length) {
                // The widget was displayed - we will use DOM to find the
                // selected nodes.
                // FIXME: this is *SLOW* for lots of values, esp in IE
                parents = parents || [];
                nodes = root.children();
                inputs = nodes.children('label').children();
                for (n = 0; n < nodes.length; n += 1) {
                    node = nodes[n];
                    item = items[n];
                    if (inputs[n].checked) {
                        item = $.extend(true, {}, item);
                        if (!isEmpty(parents)) {
                            item.parents = parents.slice();
                        }
                        selected.push(item);
                    } else {
                        childrenList = $(node).children();
                        if (childrenList.length > 1) {
                            parents.push(item.value);
                            selected = selected.concat(this.getSelected(
                                $(childrenList[1]), item.children, parents));
                            parents.pop();
                        }
                    }
                }
            } else {
                // The widget was not displayed yet - use the provided selected
                // array
                selectedList = this.options.selected;
                for (s = 0; s < selectedList.length; s += 1) {
                    selected.push(this.itemTree[selectedList[s].value].item);
                }
            }

            return selected;
        },

        // Select all checkboxes
        selectAll: function () {
            var root = this.list();
            if (root.length) {
                root.find('input').attr('checked', 'checked');
            }
            // If the widget was not displayed we don't know what to select
            // (waiting for values to come)
            this.options.onSelect.call(this);
        },

        // Select no checkboxes
        unselectAll: function () {
            var root = this.list();
            if (root.length) {
                root.find('input').removeAttr('checked');
            } else {
                this.options.selected = [];
            }
            this.options.onSelect.call(this);
        },

        // Cleanup on CheckboxTree hide. Currently only resets the quick search
        hide: function () {
            var quickSearch = this.target.children('input.quick_search');
            if (quickSearch.length && !quickSearch.hasClass('empty')) {
                quickSearch.val('').keyup().blur();
            }
        }
    };
}(jQuery));
