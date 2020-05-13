/**
 * Created by Andy Likuski on 2020.05.13
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {strPathOr} from './functions';
import {reqStrPathThrowing} from './throwingFunctions';
import {composeWithChain} from './monadHelpers';

describe('monadHelpersComponent', () => {
  const props = {jello: 'squish', stone: 'squash'};
  // Simple component
  const simpleComponent = prop => R.cond([
    [strPathOr(false, 'data.loading'), prop => `I rendered a ${JSON.stringify(prop)}`],
    [R.identity, prop => `I rendered a ${JSON.stringify(prop)}`]
  ])(prop);

  // Render function component that does something and renders the children function that is given to it
  // This would typically do something asynchronous
  const consumesRenderPropComponent = ({children, ...props}) => {
    const loadedData = R.merge(props, {data: {keyCount: R.length(R.keys(props))}});
    return children(loadedData);
  };
  // This wraps component in container by creating and outer function (Looks like chainWith)
  // Since container expects a render prop at 'children', we create a function for its children property
  // that renders component with whatever component has done with the original props
  // This doesn't need to be curried. Can also be container => component =>
  const higherOrderComponent = renderPropConsumingComponent => component => {
    // This function is a component that passes props to container that have a children function
    // added to render the component. Component might or might not also expect a children function.
    return props => {
      return renderPropConsumingComponent(R.merge(
        props,
        {
          // This will be called be returned by renderPropConsumingComponent
          // This function simply renders component, which can optionally be a higherOrderComponent
          children: componentProps => {
            return component(componentProps);
          }
        }
      ));
    };
  };

  // Render function component that does something and renders the children function that is given to it
  // This would typically do something asynchronous
  const consumesRenderPropComponentDependent = ({children, ...props}) => {
    const data = reqStrPathThrowing('data', props);
    const loading = strPathOr(false, 'loading', data);
    if (loading) {
      // If loading pass along the props without processing
      return children(props);
    }

    const loadedData = R.merge(props, {data: R.over(R.lensProp('keyCount'), keyCount => `dynamite ${keyCount}`, data)});
    return children(loadedData);
  };

  const renderPropComponentLoading = props => {
    const loadedData = R.merge(props, {data: {loading: true}});
    return props.children(loadedData);
  };

  const higherOrderComponentMaybe = container => component => {
    return Maybe.Just(props => {
      return container(R.merge(
        props,
        {
          children: componentProps => {
            return component(componentProps);
          }
        }
      ));
    });
  };

  test('Basic', () => {
    expect(higherOrderComponent(consumesRenderPropComponent)(simpleComponent)(props)).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":2}}'
    );
  });

  test('Render function component that does something', () => {
    // Now what if we have two renderPropComponents and the second depends on the first
    expect(R.compose(
      higherOrderComponent(consumesRenderPropComponent),
      higherOrderComponent(consumesRenderPropComponentDependent)
    )(simpleComponent)(props)).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":"dynamite 2"}}'
    );
  });

  test('Render using composeWith', () => {
    // Now what if we codify our highOrderComponent into composeWith
    const composeWithHighOrderComponent = R.composeWith(
      (container, component) => higherOrderComponent(container)(component)
    );
    expect(
      composeWithHighOrderComponent([
        consumesRenderPropComponent,
        consumesRenderPropComponentDependent,
        // We always have to create the monad on the first call
        higherOrderComponent(consumesRenderPropComponentDependent)
      ])(simpleComponent)(props)
    ).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":"dynamite dynamite 2"}}'
    );
  });

  // Now simulate waiting for data
  // Render function component that does something and renders the children function that is given to it
  // This would typically do something asynchronous
  test('Render with fake waiting', () => {

    expect(composeWithHighOrderComponent([
      renderPropComponentLoading,
      consumesRenderPropComponentDependent,
      // We always have to create the monad on the first call
      higherOrderComponent(consumesRenderPropComponentDependent)
    ])(simpleComponent)(props)).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"loading":true}}'
    );
  });

  // What if the higherOrderComponent wraps everything in a Just.Maybe
  // so that we can be compatible composeWithChain
  test('Compose with Maybe', () => {
    expect(composeWithChain([
      // Shed the Maybe
      R.identity,
      higherOrderComponentMaybe(consumesRenderPropComponent),
      higherOrderComponentMaybe(consumesRenderPropComponentDependent),
      higherOrderComponentMaybe(consumesRenderPropComponentDependent)
    ])(simpleComponent)(props)).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":"dynamite dynamite 2"}}'
    );
  });

  test('Compose bottomn to top', () => {
    // Let's compose outer component to inner from bottom to top now.
    // This requires a render prop function to built up backward from top to bottom when we pass the props
    // to function created by compose
    const hoc = R.compose(
      componentExpectingRenderProp => {
        // Returns the outermost component
        // This component receives the external props with a simple component specified as the children
        // By passing the props to the outermost component, it sends us into the nested components from each level
        // that have instructions to render a child at that level using the render prop
        return props => {
          const children = R.prop('children', props);
          return componentExpectingRenderProp(R.merge(props, {
            children: p => children(p)
          }));
        };
      },
      componentExpectingRenderProp => {
        // Wrap componentExpectingRenderProp in a component that provides it with props.children render function
        return props => {
          // Take the children function above and wrap it so it renders the component at this level
          const outerChildrenRenderProp = R.prop('children', props);
          return componentExpectingRenderProp(R.merge(props, {
            children: p => {
              return consumesRenderPropComponentDependent(R.merge(p, {children: outerChildrenRenderProp}));
            }
          }));
        };
      },
      componentExpectingRenderProp => {
        return props => {
          // Take the children function above and wrap it so it renders the component at this level
          const outerChildrenRenderProp = R.prop('children', props);
          return componentExpectingRenderProp(R.merge(props, {
            children: p => {
              return consumesRenderPropComponentDependent(R.merge(p, {children: outerChildrenRenderProp}));
            }
          }));
        };
      },
      () => {
        return props => {
          // Receives built up children render prop. This is the outer component so it can just be called.
          return consumesRenderPropComponent(props);
        };
      }
    )();

    hoc(R.merge(props, {children: simpleComponent})).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":"dynamite dynamite 2"}}'
    );
  })
});